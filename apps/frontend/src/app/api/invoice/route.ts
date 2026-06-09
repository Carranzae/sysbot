import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerPhone, customerName, amount, items } = body;

    if (!customerPhone) {
      return NextResponse.json({
        success: false,
        message: 'El teléfono del cliente (customerPhone) es obligatorio'
      }, { status: 400 });
    }

    // Calcular valores tributarios en base a amount o items
    const baseAmount = amount || (items ? items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0) : 100);
    
    // Desglose de IGV (18% incluido en el precio final)
    const total = parseFloat(Number(baseAmount).toFixed(2));
    const subtotal = parseFloat(Number(total / 1.18).toFixed(2));
    const igv = parseFloat(Number(total - subtotal).toFixed(2));

    const invoiceItems = items || [
      {
        description: 'Servicio de Asistencia Médica / Consulta',
        quantity: 1,
        unitPrice: total,
        totalPrice: total,
      }
    ];

    const documentType = '03'; // 03 = Boleta de Venta Electrónica
    const series = 'B001';
    const sequential = Math.floor(100000 + Math.random() * 900000);
    const invoiceNumber = `${series}-${sequential}`;

    // Estructurar el payload JSON oficial requerido por SUNAT / OSE (UBL 2.1)
    const sunatPayload = {
      tipoDocumento: documentType,
      serie: series,
      correlativo: sequential.toString(),
      fechaEmision: new Date().toISOString().split('T')[0],
      horaEmision: new Date().toTimeString().split(' ')[0],
      emisor: {
        ruc: '20608945231',
        razonSocial: 'SYBOT ENTERPRISE S.A.C.',
        nombreComercial: 'Sybot AI',
        direccion: 'Av. Larco 123, Miraflores, Lima'
      },
      cliente: {
        tipoDocumento: customerPhone.length === 8 ? '1' : '6', // 1 = DNI, 6 = RUC / default
        numeroDocumento: customerPhone.replace(/\D/g, '').substring(0, 11) || '00000000',
        razonSocial: customerName || 'Cliente Genérico'
      },
      moneda: 'PEN',
      totalValorVenta: subtotal,
      totalIgv: igv,
      totalImporte: total,
      detalles: invoiceItems.map((item: any, idx: number) => {
        const itemQty = item.quantity || 1;
        const itemPrice = item.unitPrice || item.price || total;
        const itemTotal = parseFloat(Number(itemPrice * itemQty).toFixed(2));
        const itemSubtotal = parseFloat(Number(itemTotal / 1.18).toFixed(2));
        const itemIgv = parseFloat(Number(itemTotal - itemSubtotal).toFixed(2));

        return {
          index: idx + 1,
          unidadMedida: 'ZZ', // Unidad de servicio
          cantidad: itemQty,
          descripcion: item.description,
          valorUnitario: parseFloat(Number(itemPrice / 1.18).toFixed(2)),
          precioUnitario: itemPrice,
          igv: itemIgv,
          baseImponible: itemSubtotal,
          codigoImpuesto: '1000', // IGV
          tipoAfectacion: '10' // Gravado - Operación Onerosa
        };
      })
    };

    // Retornar la boleta emitida (simulada/stub para conectar con APIs reales)
    return NextResponse.json({
      success: true,
      message: 'Comprobante electrónico estructurado con éxito para SUNAT/OSE',
      invoiceNumber,
      subtotal,
      igv,
      total,
      sunatPayload,
      status: 'EMITTED_STUB'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error al generar la estructura de facturación electrónica',
      error: error.message
    }, { status: 400 });
  }
}
