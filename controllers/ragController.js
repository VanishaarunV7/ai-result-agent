const multer = require('multer');
let pdfParse;
try {
  pdfParse = require('pdf-parse/lib/pdf-parse.js');
} catch(e) {
  pdfParse = require('pdf-parse');
}
const mongoose = require('mongoose');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Fix 1: Multer - use memoryStorage (no disk needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'), false);
    }
  }
});

// Fix 2: Upload API - handle buffer directly
exports.uploadPDF = [
  upload.single('pdf'),
  async (req, res) => {
    try {
      // Check file exists
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No PDF file uploaded' 
        });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ 
          success: false, 
          error: 'No file buffer found' 
        });
      }

      try {
        // Fix 3: Pass buffer directly to pdf-parse
        const data = await pdfParse(req.file.buffer);
        const extractedText = data.text;

        if (!extractedText || extractedText.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'PDF has no readable text (may be image-based)'
          });
        }

        // Fix 4: Split into chunks for MongoDB storage
        const chunkSize = 1000;
        const chunks = [];
        for (let i = 0; i < extractedText.length; i += chunkSize) {
          chunks.push(extractedText.slice(i, i + chunkSize));
        }

        // Fix 5: Store in MongoDB
        const col = mongoose.connection.db.collection('ragdocuments');
        const result = await col.insertOne({
          fileName: req.file.originalname,
          fileSize: req.file.size,
          totalPages: data.numpages,
          fullText: extractedText,
          chunks: chunks,
          chunkCount: chunks.length,
          uploadedAt: new Date(),
          status: 'active'
        });

        res.json({
          success: true,
          docId: result.insertedId.toString(),
          fileName: req.file.originalname,
          pages: data.numpages,
          textLength: extractedText.length,
          chunkCount: chunks.length,
          message: 'PDF uploaded and processed successfully'
        });

      } catch (pdfError) {
        console.error('PDF Parse Error:', pdfError.message);
        return res.status(500).json({
          success: false,
          error: 'PDF parsing failed: ' + pdfError.message
        });
      }

    } catch (error) {
      console.error('PDF Upload Error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'PDF processing failed'
      });
    }
  }
];

// Fix 6: Ask question about PDF
exports.askPDF = async (req, res) => {
  try {
    const { question, docId } = req.body;

    if (!question || !docId) {
      return res.status(400).json({ 
        error: 'question and docId required' 
      });
    }

    const { ObjectId } = require('mongodb');
    const col = mongoose.connection.db.collection('ragdocuments');
    
    const doc = await col.findOne({ 
      _id: new ObjectId(docId) 
    });

    if (!doc) {
      return res.status(404).json({ 
        error: 'Document not found' 
      });
    }

    // Find most relevant chunk
    const questionWords = question.toLowerCase().split(' ');
    let bestChunk = doc.chunks[0];
    let bestScore = 0;

    doc.chunks.forEach(chunk => {
      const chunkLower = chunk.toLowerCase();
      let score = 0;
      questionWords.forEach(word => {
        if (word.length > 3 && chunkLower.includes(word)) {
          score++;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
      }
    });

    const prompt = `
You are a study assistant. Answer the question using ONLY 
the provided document content. If answer not in content, 
say "This information is not in the uploaded document."

Document content:
${bestChunk}

Question: ${question}

Answer in 2-3 sentences only.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 200
    });

    res.json({
      answer: completion.choices[0].message.content,
      sourceFile: doc.fileName
    });

  } catch (error) {
    console.error('Ask PDF Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Fix 7: Generate questions from PDF
exports.generateQuestions = async (req, res) => {
  try {
    const { docId, topic, count = 5 } = req.body;

    if (!docId) {
      return res.status(400).json({ error: 'docId required' });
    }

    const { ObjectId } = require('mongodb');
    const col = mongoose.connection.db.collection('ragdocuments');
    
    const doc = await col.findOne({ 
      _id: new ObjectId(docId) 
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Use first 3000 chars for question generation
    const content = doc.fullText.slice(0, 3000);

    const prompt = `
Based on this educational content, generate exactly ${count} 
important exam questions${topic ? ' about ' + topic : ''}.

Content:
${content}

Return ONLY a JSON array like this (no other text):
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 500
    });

    let questions = [];
    try {
      const responseText = completion.choices[0].message.content;
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      questions = ['Could not parse questions. Try again.'];
    }

    res.json({
      success: true,
      questions,
      sourceFile: doc.fileName,
      count: questions.length
    });

  } catch (error) {
    console.error('Generate Questions Error:', error);
    res.status(500).json({ error: error.message });
  }
};
