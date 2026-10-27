import PDFDocument from 'pdfkit';

/**
 * Generates payslip PDF as a buffer
 */
export function generatePayslipPdfBuffer(payslip, company = { name: 'HCM Lite' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fontSize(20).text(company.name || 'HCM Lite', { align: 'center' });
      doc.fontSize(14).text(`Payslip for ${payslip.month}`, { align: 'center' });
      doc.moveDown(1.5);

      // Employee Information Table
      doc.fontSize(10);
      const topInfoY = doc.y;

      doc.text(`Employee Code: ${payslip.employeeCode}`, 40, topInfoY);
      doc.text(`Employee Name: ${payslip.employeeName}`, 40, topInfoY + 15);
      doc.text(`Department: ${payslip.departmentName || 'N/A'}`, 40, topInfoY + 30);
      doc.text(`Designation: ${payslip.designationTitle || 'N/A'}`, 40, topInfoY + 45);

      doc.text(`Working Days in Month: ${payslip.workingDaysInMonth}`, 320, topInfoY);
      doc.text(`Days Worked: ${payslip.daysWorked}`, 320, topInfoY + 15);
      doc.text(`Absents / Unpaid: ${payslip.absentDays} / ${payslip.unpaidLeaveDays}`, 320, topInfoY + 30);
      doc.text(`Half Days / Lates: ${payslip.halfDays} / ${payslip.lateCount}`, 320, topInfoY + 45);

      doc.moveDown(4);
      const dividerY = doc.y;
      doc.moveTo(40, dividerY).lineTo(550, dividerY).stroke();
      doc.moveDown(1);

      // Earnings & Deductions Columns
      const tableTop = doc.y;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Earnings', 40, tableTop);
      doc.text('Amount (PKR)', 200, tableTop, { align: 'right' });

      doc.text('Deductions', 320, tableTop);
      doc.text('Amount (PKR)', 500, tableTop, { align: 'right' });

      doc.font('Helvetica').fontSize(10);
      let curY = tableTop + 20;

      // Earnings rows
      doc.text('Basic Salary', 40, curY);
      doc.text(Number(payslip.basicSalary).toLocaleString(), 200, curY, { align: 'right' });

      doc.text('Attendance Deductions', 320, curY);
      doc.text(Number(payslip.attendanceDeduction).toLocaleString(), 500, curY, { align: 'right' });
      curY += 15;

      doc.text('House Rent Allowance (HRA)', 40, curY);
      doc.text(Number(payslip.hra).toLocaleString(), 200, curY, { align: 'right' });

      doc.text('Late Penalties', 320, curY);
      doc.text(Number(payslip.latePenaltyDeduction).toLocaleString(), 500, curY, { align: 'right' });
      curY += 15;

      doc.text('Medical Allowance', 40, curY);
      doc.text(Number(payslip.medical).toLocaleString(), 200, curY, { align: 'right' });

      doc.text('Income Tax (Monthly)', 320, curY);
      doc.text(Number(payslip.monthlyTax).toLocaleString(), 500, curY, { align: 'right' });
      curY += 15;

      if (payslip.otherAllowances > 0) {
        doc.text('Other Allowances', 40, curY);
        doc.text(Number(payslip.otherAllowances).toLocaleString(), 200, curY, { align: 'right' });
        curY += 15;
      }

      curY += 10;
      doc.moveTo(40, curY).lineTo(550, curY).stroke();
      curY += 10;

      doc.font('Helvetica-Bold');
      doc.text('Gross Earnings', 40, curY);
      doc.text(Number(payslip.proratedGross).toLocaleString(), 200, curY, { align: 'right' });

      doc.text('Total Deductions & Tax', 320, curY);
      const totalAllDeductions = payslip.totalDeductions + payslip.monthlyTax;
      doc.text(Number(totalAllDeductions).toLocaleString(), 500, curY, { align: 'right' });

      curY += 25;
      doc.moveTo(40, curY).lineTo(550, curY).stroke();
      curY += 15;

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('NET SALARY PAYABLE:', 40, curY);
      doc.text(`PKR ${Number(payslip.netSalary).toLocaleString()}`, 300, curY, { align: 'right' });

      curY += 40;
      doc.fontSize(8).font('Helvetica');
      doc.text('This is a computer-generated payslip and requires no signature.', 40, curY, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
