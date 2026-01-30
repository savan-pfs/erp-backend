const PDFDocument = require('pdfkit');

function generateInvoicePDF(invoice, organization, user, res) {
    const doc = new PDFDocument({ margin: 50 });

    // Stream to response
    doc.pipe(res);

    // --- Header ---
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('INVOICE', 50, 57)
        .fontSize(10)
        .text('Cultivation Compass', 200, 50, { align: 'right' })
        .text('123 AgTech Blvd', 200, 65, { align: 'right' })
        .text('Denver, CO 80202', 200, 80, { align: 'right' })
        .moveDown();

    // --- Separator ---
    doc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, 100)
        .lineTo(550, 100)
        .stroke();

    // --- Customer Details ---
    doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Bill To:', 50, 130)
        .font('Helvetica')
        .text(organization.name, 50, 145)
        .text(organization.address || 'Address on file', 50, 160)
        .text(organization.email || user?.email || '', 50, 175)
        .moveDown();

    // --- Invoice Details ---
    doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Invoice Number:', 400, 130)
        .font('Helvetica')
        .text(invoice.invoice_number, 500, 130, { align: 'right' })
        .font('Helvetica-Bold')
        .text('Invoice Date:', 400, 145)
        .font('Helvetica')
        .text(new Date(invoice.issue_date).toLocaleDateString(), 500, 145, { align: 'right' })
        .font('Helvetica-Bold')
        .text('Due Date:', 400, 160)
        .font('Helvetica')
        .text(new Date(invoice.due_date || invoice.issue_date).toLocaleDateString(), 500, 160, { align: 'right' })
        .font('Helvetica-Bold')
        .text('Amount Due:', 400, 175)
        .font('Helvetica')
        .text(`$${parseFloat(invoice.amount).toFixed(2)}`, 500, 175, { align: 'right' })
        .moveDown();

    // --- Table Header ---
    const tableTop = 250;
    doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Description', 50, tableTop)
        .text('Quantity', 300, tableTop)
        .text('Unit Price', 370, tableTop, { width: 90, align: 'right' })
        .text('Total', 0, tableTop, { align: 'right' });

    // --- Separator ---
    doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

    // --- Line Items ---
    const itemCode = invoice.subscription_plan || 'Subscription';
    const description = `${organization.subscription_plan || 'Platform'} Plan Subscription`;
    const amount = parseFloat(invoice.amount).toFixed(2);
    const position = tableTop + 30;

    doc
        .font('Helvetica')
        .fontSize(10)
        .text(description, 50, position)
        .text('1', 300, position)
        .text(`$${amount}`, 370, position, { width: 90, align: 'right' })
        .text(`$${amount}`, 0, position, { align: 'right' });

    // --- Separator ---
    doc
        .moveTo(50, position + 20)
        .lineTo(550, position + 20)
        .stroke();

    // --- Totals ---
    const subtotalPosition = position + 40;
    doc
        .font('Helvetica-Bold')
        .text('Subtotal:', 380, subtotalPosition)
        .text(`$${amount}`, 0, subtotalPosition, { align: 'right' });

    const taxPosition = subtotalPosition + 15;
    doc
        .text('Tax (0%):', 380, taxPosition)
        .text('$0.00', 0, taxPosition, { align: 'right' });

    const totalPosition = taxPosition + 25;
    doc
        .fontSize(12)
        .text('Total Due:', 380, totalPosition)
        .text(`$${amount}`, 0, totalPosition, { align: 'right' });

    // --- Footer ---
    doc
        .fontSize(10)
        .fillColor('#555555')
        .text('Thank you for your business.', 50, 700, { align: 'center', width: 500 });

    doc.end();
}

module.exports = { generateInvoicePDF };
