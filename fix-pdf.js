const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const targetStr = `  function downloadPDF() {
    const studentId = getStudentId();
    
    doc.text('Topic-wise Performance:', 20, 80);
    const topicResults = currentSummaryData.topicResults || [];
    topicResults.forEach((t, i) => {
      doc.text(
        \`\${t.topic}: \${t.percentage}% (\${t.level})\`, 
        20, 
        95 + (i * 10)
      );
    });
    
    doc.save(\`report_\${studentId}.pdf\`);
  }`;

const replacementStr = `  function downloadPDF() {
    const studentId = getStudentId();
    
    // Check if jsPDF is available
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showNotification("Error: PDF library not loaded.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const name = document.getElementById('studentName') ? document.getElementById('studentName').textContent : 'Student';
    const program = document.getElementById('studentProgram') ? document.getElementById('studentProgram').textContent : '';
    const overall = document.getElementById('overallPercentage') ? document.getElementById('overallPercentage').textContent : '';
    const improvement = document.getElementById('improvement') ? document.getElementById('improvement').textContent : '';
    const examsAttended = document.getElementById('examsAttended') ? document.getElementById('examsAttended').textContent : '';
    const nextExam = document.getElementById('nextExamKpi') ? document.getElementById('nextExamKpi').textContent : '';
    
    doc.setFontSize(22);
    doc.text("Student Performance Report", 20, 20);
    
    doc.setFontSize(12);
    doc.text(\`Student Name: \${name}\`, 20, 35);
    doc.text(\`Student ID: \${studentId}\`, 20, 42);
    doc.text(\`Program: \${program}\`, 20, 49);
    
    doc.text(\`Overall Percentage: \${overall}\`, 120, 35);
    doc.text(\`Improvement: \${improvement}\`, 120, 42);
    doc.text(\`Exams Attended: \${examsAttended}\`, 120, 49);
    doc.text(\`Next Exam: \${nextExam}\`, 120, 56);
    
    doc.setLineWidth(0.5);
    doc.line(20, 60, 190, 60);
    
    doc.setFontSize(16);
    doc.text("Course Performance", 20, 75);
    
    doc.setFontSize(12);
    let yPos = 85;
    
    // Group exams by course
    const courseMap = {};
    if (currentSummaryData && currentSummaryData.examSummaries) {
      currentSummaryData.examSummaries.forEach(ex => {
        if (!courseMap[ex.courseName]) courseMap[ex.courseName] = [];
        courseMap[ex.courseName].push(ex);
      });
      
      Object.keys(courseMap).forEach(cName => {
        const exams = courseMap[cName];
        exams.sort((a,b) => a.examName.localeCompare(b.examName));
        
        let it1 = '--', it2 = '--', it3 = '--';
        let sum = 0;
        
        exams.forEach(ex => {
          if (ex.examName.includes('Internal Test 1')) it1 = ex.percentage + '%';
          if (ex.examName.includes('Internal Test 2')) it2 = ex.percentage + '%';
          if (ex.examName.includes('Internal Test 3')) it3 = ex.percentage + '%';
          sum += ex.percentage;
        });
        
        const avg = exams.length ? (sum / exams.length).toFixed(1) + '%' : '--';
        
        let trend = 'Neutral';
        if (exams.length >= 2) {
          if (exams[exams.length-1].percentage > exams[0].percentage) trend = 'Improving ↗️';
          else if (exams[exams.length-1].percentage < exams[0].percentage) trend = 'Declining ↘️';
        }
        
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text(\`Course: \${cName}\`, 20, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 7;
        doc.text(\`Internal Test 1: \${it1}   |   Internal Test 2: \${it2}   |   Internal Test 3: \${it3}\`, 25, yPos);
        yPos += 7;
        doc.text(\`Average: \${avg}   |   Trend: \${trend.replace('↗️', '(Up)').replace('↘️', '(Down)')}\`, 25, yPos);
        yPos += 12;
      });
    } else {
        doc.text("No course performance data available.", 20, yPos);
    }
    
    doc.save(\`report_\${studentId}.pdf\`);
  }`;

if (html.includes(targetStr)) {
  html = html.replace(targetStr, replacementStr);
  fs.writeFileSync('index.html', html);
  console.log('Fixed downloadPDF.');
} else {
  console.log('Target string not found.');
  // write target to file for debugging
  fs.writeFileSync('target.txt', targetStr);
}
