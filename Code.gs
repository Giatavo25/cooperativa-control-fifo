/**
 * SICOOP - Sistema de Control de Inventario FIFO y Prepagos
 * Backend completo para Google Apps Script
 */

function doGet(e) {
  var callback = e ? e.parameter.callback : null;
  var payload = e ? e.parameter.payload : null;
  
  // 1. MANEJO DE ENVÍOS DESDE LA WEB (POST SIMULADO VÍA URL)
  if (payload) {
    try {
      var payloadDecodificado = decodeURIComponent(payload.replace(/\+/g, '%20'));
      var datosRecibidos = JSON.parse(payloadDecodificado);
      var resultadoAccion = procesarAccionWeb(datosRecibidos);
      
      if (callback) {
        return ContentService.createTextOutput(callback + "(" + JSON.stringify(resultadoAccion) + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(JSON.stringify(resultadoAccion))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      var errorRes = { status: "error", message: "Falla de parseo en backend: " + err.toString() };
      if (callback) {
        return ContentService.createTextOutput(callback + "(" + JSON.stringify(errorRes) + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(JSON.stringify(errorRes))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // 2. MANEJO DE LECTURA DE DATOS (DASHBOARD, RECEPCIÓN, PROVEEDORES Y REPORTES)
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // A. Leer Pestaña Proveedores
    var sheetProv = ss.getSheetByName("Proveedores") || ss.getSheets()[0];
    var dataProv = sheetProv.getDataRange().getValues();
    var listaProveedores = [];
    for (var i = 1; i < dataProv.length; i++) {
      if (dataProv[i][0]) {
        var productosArray = dataProv[i][1] ? dataProv[i][1].toString().split(",").map(function(p){ return p.trim(); }) : [];
        listaProveedores.push({ nombre: dataProv[i][0].toString(), productos: productosArray });
      }
    }
    
    // B. Leer Pestaña Prepagos (Cola FIFO Activa)
    var sheetPre = ss.getSheetByName("Prepagos");
    var detallesLotes = [];
    var resumenConsolidated = {};
    var prepagosListaSimple = [];
    
    if (sheetPre) {
      var dataPre = sheetPre.getDataRange().getValues();
      for (var j = 1; j < dataPre.length; j++) {
        var idLote = dataPre[j][0];
        var prov = dataPre[j][1];
        var prod = dataPre[j][2];
        var cantOrig = parseFloat(dataPre[j][3]);
        var cantDisp = parseFloat(dataPre[j][4]);
        var costoUsd = parseFloat(dataPre[j][5]);
        var tasaOriginal = parseFloat(dataPre[j][8]);
        var fechaOrigen = dataPre[j][9];

        if (idLote && prov) { 
          cantOrig = isNaN(cantOrig) ? 0 : cantOrig;
          cantDisp = isNaN(cantDisp) ? 0 : cantDisp;
          costoUsd = isNaN(costoUsd) ? 0 : costoUsd;
          tasaOriginal = isNaN(tasaOriginal) ? 1 : tasaOriginal;

          detallesLotes.push({
            idLote: idLote.toString(),
            proveedor: prov.toString(),
            producto: prod ? prod.toString() : "N/A",
            cantOriginal: cantOrig,
            cantDisponible: cantDisp,
            costoUsd: costoUsd,
            tasaOriginal: tasaOriginal,
            fecha: fechaOrigen
          });

          prepagosListaSimple.push({
            lote: idLote.toString(),
            proveedor: prov.toString(),
            producto: prod ? prod.toString() : "N/A",
            cantidad: cantOrig,
            costo: costoUsd,
            fecha: fechaOrigen
          });
          
          var provKey = prov.toString().trim();
          if (!resumenConsolidated[provKey]) {
            resumenConsolidated[provKey] = { proveedor: provKey, totalRecibido: 0, totalPendiente: 0 };
          }
          resumenConsolidated[provKey].totalPendiente += cantDisp;
          resumenConsolidated[provKey].totalRecibido += (cantOrig - cantDisp);
        }
      }
    }

    // C. Leer Pestaña Despachos_Recibidos (Historial exacto)
    var sheetDesp = ss.getSheetByName("Despachos_Recibidos");
    var historialDespachos = [];
    if (sheetDesp) {
      var dataDesp = sheetDesp.getDataRange().getValues();
      for (var k = 1; k < dataDesp.length; k++) {
        if (dataDesp[k][0] || dataDesp[k][1] || dataDesp[k][3]) {
          historialDespachos.push({
            fila: k + 1,
            idLote: dataDesp[k][0] ? dataDesp[k][0].toString() : "",
            nroFactura: dataDesp[k][1] ? dataDesp[k][1].toString() : "N/A",
            fechaRecepcion: dataDesp[k][2] ? Utilities.formatDate(new Date(dataDesp[k][2]), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : "N/A",
            proveedor: dataDesp[k][3] ? dataDesp[k][3].toString() : "",
            producto: dataDesp[k][4] ? dataDesp[k][4].toString() : "",
            cantidadRecibida: parseFloat(dataDesp[k][5]) || 0,
            montoFactura: parseFloat(dataDesp[k][6]) || 0,
            difCambiaria: parseFloat(dataDesp[k][7]) || 0
          });
        }
      }
    }
    
    var responseData = {
      status: "success",
      prepagos: prepagosListaSimple,
      proveedores: listaProveedores,
      data: {
        proveedores: listaProveedores,
        detallesLotes: detallesLotes,
        resumenConsolidated: Object.values(resumenConsolidated),
        historialDespachos: historialDespachos
      }
    };
    
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(responseData) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(e) {
    var errResponse = { status: "error", message: e.toString() };
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(errResponse) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 3. PROCESAMIENTO Y ASENTAMIENTO DE ACCIONES EN HOJAS DE CÁLCULO
 */
function procesarAccionWeb(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ACCIÓN 1: REGISTRAR NUEVO PROVEEDOR
  if (payload.accion === "registrar_proveedor") {
    var sheet = ss.getSheetByName("Proveedores") || ss.getSheets()[0];
    sheet.appendRow([payload.data.nombre, payload.data.productos]);
    return { status: "success", message: "Proveedor añadido con éxito" };
  }
  
  // ACCIÓN 2: REGISTRO DE PREPAGO CONSOLIDADO / MULTI-ÍTEM
  if (payload.accion === "registrar_prepago_consolidado" || payload.accion === "registrar_prepago") {
    var data = payload.data;
    
    var sheetPre = ss.getSheetByName("Prepagos");
    if (!sheetPre) {
      sheetPre = ss.insertSheet("Prepagos");
      sheetPre.appendRow(["ID_Lote", "Proveedor", "Producto", "Cant_Original", "Cant_Disponible", "Costo_USD", "Total_USD", "Total_Bs", "Tasa_Origen", "Fecha"]);
    }
    
    var fechaFormateada = parsearFechaLocal(data.fecha);
    var tasaAplicada = parseFloat(data.tasa || data.tasaCambio || 1);
    var loteId = data.idLote || data.lote || obtenerSiguienteLote();
    
    if (data.items && Array.isArray(data.items)) {
      for (var m = 0; m < data.items.length; m++) {
        var item = data.items[m];
        var cantidad = parseFloat(item.cantidad) || 0;
        var costoUsd = parseFloat(item.costoUsd || item.costoUnit || item.costo || item.precio || 0); 
        var costoTotalUsd = cantidad * costoUsd;
        var costoTotalBs = costoTotalUsd * tasaAplicada;
        
        sheetPre.appendRow([
          loteId, 
          data.proveedor, 
          item.producto || "N/A", 
          cantidad, 
          cantidad, // Cantidad Disponible inicial igual a la prepagada
          costoUsd,
          costoTotalUsd,
          costoTotalBs,
          tasaAplicada,
          fechaFormateada
        ]);
      }
    } else {
      var cantDirecta = parseFloat(data.cantidad) || 0;
      var costoDirecto = parseFloat(data.costoUsd || data.costoUnit || data.costo || 0);
      var totalUsdDirecto = cantDirecta * costoDirecto;
      
      sheetPre.appendRow([
        loteId,
        data.proveedor,
        data.producto || "N/A",
        cantDirecta,
        cantDirecta,
        costoDirecto, 
        totalUsdDirecto, 
        totalUsdDirecto * tasaAplicada, 
        tasaAplicada,
        fechaFormateada
      ]);
    }
    
    // Guardar registro bancario
    var sheetPagos = ss.getSheetByName("HistorialPagosBancos");
    if (!sheetPagos) {
      sheetPagos = ss.insertSheet("HistorialPagosBancos");
      sheetPagos.appendRow(["Fecha Operación", "ID Lote", "Proveedor", "Banesco (Bs)", "Mercantil (Bs)", "Provincial (Bs)", "Bancaribe (Bs)", "Banco Activo (Bs)", "Tasa Aplicada"]);
    }
    
    var b = data.bancos || {};
    sheetPagos.appendRow([
      fechaFormateada,
      loteId,
      data.proveedor,
      parseFloat(b.BANESCO || b.banesco || 0),
      parseFloat(b.MERCANTIL || b.mercantil || 0),
      parseFloat(b.PROVINCIAL || b.provincial || 0),
      parseFloat(b.BANCARIBE || b.bancaribe || 0),
      parseFloat(b.BANCO_ACTIVO || b.banco_activo || b.b_activo || b.activo || 0),
      tasaAplicada
    ]);
    
    return { status: "success", message: "Lote " + loteId + " asentado correctamente.", siguienteLote: obtenerSiguienteLote() };
  }

  // ACCIÓN 3: MOTOR FIFO DE RECEPCIÓN DE CARGA (GRABAR EN Despachos_Recibidos)
  if (payload.accion === "registrar_despacho" || payload.accion === "registrar_recepcion_carga") {
    var d = payload.data;
    var sheetPre = ss.getSheetByName("Prepagos");
    if (!sheetPre) return { status: "error", message: "Pestaña 'Prepagos' no encontrada." };

    var sheetDesp = ss.getSheetByName("Despachos_Recibidos");
    if (!sheetDesp) {
      sheetDesp = ss.insertSheet("Despachos_Recibidos");
      sheetDesp.appendRow([
        "ID_Lote", "Nro_Factura_Entrega", "Fecha_Recepcion", 
        "Proveedor", "Producto", "Cantidad_Recibida", 
        "Monto_Factura", "Dif-Cambiaria"
      ]);
    }

    var dataPre = sheetPre.getDataRange().getValues();
    var remanente = parseFloat(d.cantidad) || 0;
    var tasaRecepcion = parseFloat(d.tasaRecepcion) || 1;
    var fechaDespacho = parsearFechaLocal(d.fecha);
    var nroFactura = d.nroFactura || d.factura || "N/A";

    if (remanente <= 0) return { status: "error", message: "La cantidad a recibir debe ser mayor a cero." };

    var lotesAfectados = [];

    // Determinar el ORDEN de las filas de "Prepagos" a procesar:
    // - Si el frontend envía "lotesSeleccionados" (selección manual activada por el usuario),
    //   se respeta EXCLUSIVAMENTE ese orden y esos lotes (excepción puntual al FIFO).
    // - Si no viene nada (caso normal), se recorre en orden natural de fila = FIFO puro
    //   (el lote más viejo primero), tal como funcionaba hasta ahora.
    var ordenFilas = [];
    if (d.lotesSeleccionados && Array.isArray(d.lotesSeleccionados) && d.lotesSeleccionados.length > 0) {
      for (var s = 0; s < d.lotesSeleccionados.length; s++) {
        var idBuscado = d.lotesSeleccionados[s] ? d.lotesSeleccionados[s].toString() : "";
        for (var r2 = 1; r2 < dataPre.length; r2++) {
          var idFila2 = dataPre[r2][0] ? dataPre[r2][0].toString() : "";
          if (idFila2 === idBuscado) {
            ordenFilas.push(r2);
            break;
          }
        }
      }
    } else {
      for (var r3 = 1; r3 < dataPre.length; r3++) {
        ordenFilas.push(r3);
      }
    }

    // Recorrer filas en el orden determinado arriba (manual o FIFO natural)
    for (var oi = 0; oi < ordenFilas.length; oi++) {
      if (remanente <= 0) break;
      var r = ordenFilas[oi];

      var idLoteFila = dataPre[r][0] ? dataPre[r][0].toString() : "";
      var provFila = dataPre[r][1] ? dataPre[r][1].toString() : "";
      var prodFila = dataPre[r][2] ? dataPre[r][2].toString() : "";
      var cantDispFila = parseFloat(dataPre[r][4]) || 0;

      if (provFila === d.proveedor && prodFila === d.producto && cantDispFila > 0) {
        var cantTomada = Math.min(remanente, cantDispFila);
        var nuevaCantDisp = cantDispFila - cantTomada;

        var costoUsdUnit = parseFloat(dataPre[r][5]) || 0;
        var tasaOrigen = parseFloat(dataPre[r][8]) || 1;

        // Cálculos Financieros por Tramo/Lote
        var montoFacturaBs = cantTomada * costoUsdUnit * tasaRecepcion; 
        var totalBsOrigen = cantTomada * costoUsdUnit * tasaOrigen;    
        var diffCambiaria = montoFacturaBs - totalBsOrigen;            

        // Actualizar memoria
        dataPre[r][4] = nuevaCantDisp;
        remanente -= cantTomada;

        // Insertar registro en Despachos_Recibidos
        sheetDesp.appendRow([
          idLoteFila,
          nroFactura,
          fechaDespacho,
          provFila,
          prodFila,
          cantTomada,
          montoFacturaBs,
          diffCambiaria
        ]);

        lotesAfectados.push({ fila: r + 1, nuevaDisponibilidad: nuevaCantDisp });
      }
    }

    if (remanente > 0) {
      var mensajeError = (d.lotesSeleccionados && d.lotesSeleccionados.length > 0)
        ? "El/los lote(s) seleccionado(s) manualmente no tienen existencia suficiente. Faltaron " + remanente + " unidades."
        : "No hay suficiente existencia prepagada en cola FIFO. Faltaron " + remanente + " unidades.";
      return { status: "error", message: mensajeError };
    }

    // Aplicar los nuevos saldos en la pestaña Prepagos (Columna E / 5)
    for (var u = 0; u < lotesAfectados.length; u++) {
      sheetPre.getRange(lotesAfectados[u].fila, 5).setValue(lotesAfectados[u].nuevaDisponibilidad);
    }

    return { status: "success", message: "Despacho guardado en 'Despachos_Recibidos' y descontado con éxito." };
  }
  
  // ACCIÓN 4: EDITAR UN PREPAGO YA EXISTENTE (actualiza en sitio la fila de Prepagos
  // identificada por ID_Lote + Producto, en vez de crear una fila nueva)
  if (payload.accion === "editar_prepago") {
    var dEdit = payload.data;
    var sheetPreEdit = ss.getSheetByName("Prepagos");
    if (!sheetPreEdit) return { status: "error", message: "Pestaña 'Prepagos' no encontrada." };

    var dataPreEdit = sheetPreEdit.getDataRange().getValues();
    var filaEncontrada = -1;
    for (var re = 1; re < dataPreEdit.length; re++) {
      var idFilaE = dataPreEdit[re][0] ? dataPreEdit[re][0].toString() : "";
      var prodFilaE = dataPreEdit[re][2] ? dataPreEdit[re][2].toString() : "";
      if (idFilaE === (dEdit.idLote || "").toString() && prodFilaE === (dEdit.producto || "").toString()) {
        filaEncontrada = re;
        break;
      }
    }

    if (filaEncontrada === -1) {
      return { status: "error", message: "No se encontró el registro de prepago a editar (Lote " + dEdit.idLote + " / " + dEdit.producto + ")." };
    }

    var cantOriginalVieja = parseFloat(dataPreEdit[filaEncontrada][3]) || 0;
    var cantDisponibleVieja = parseFloat(dataPreEdit[filaEncontrada][4]) || 0;
    var yaConsumido = cantOriginalVieja - cantDisponibleVieja;

    var nuevaCantidad = parseFloat(dEdit.cantidad) || 0;
    var nuevoCostoUsd = parseFloat(dEdit.costoUsd) || 0;
    var nuevaTasa = parseFloat(dEdit.tasa) || 1;
    var nuevaFechaEdit = parsearFechaLocal(dEdit.fecha);

    if (nuevaCantidad < yaConsumido) {
      return {
        status: "error",
        message: "No se puede reducir la cantidad a " + nuevaCantidad + ": ya se han recibido " + yaConsumido + " unidades de este lote en Recepción de Carga."
      };
    }

    var nuevaCantDisponible = nuevaCantidad - yaConsumido;
    var nuevoTotalUsd = nuevaCantidad * nuevoCostoUsd;
    var nuevoTotalBs = nuevoTotalUsd * nuevaTasa;

    sheetPreEdit.getRange(filaEncontrada + 1, 1, 1, 10).setValues([[
      dEdit.idLote, dEdit.proveedor, dEdit.producto, nuevaCantidad, nuevaCantDisponible,
      nuevoCostoUsd, nuevoTotalUsd, nuevoTotalBs, nuevaTasa, nuevaFechaEdit
    ]]);

    return { status: "success", message: "Prepago del lote " + dEdit.idLote + " actualizado correctamente." };
  }

  // ACCIÓN 5: EDITAR UNA RECEPCIÓN (DESPACHO) YA REGISTRADA, identificada por su fila exacta
  // en Despachos_Recibidos. Reajusta también la Cant_Disponible del lote de origen en Prepagos
  // según la diferencia entre la cantidad vieja y la nueva.
  if (payload.accion === "editar_despacho") {
    var dDesp = payload.data;
    var sheetDespEdit = ss.getSheetByName("Despachos_Recibidos");
    var sheetPreParaDesp = ss.getSheetByName("Prepagos");
    if (!sheetDespEdit) return { status: "error", message: "Pestaña 'Despachos_Recibidos' no encontrada." };
    if (!sheetPreParaDesp) return { status: "error", message: "Pestaña 'Prepagos' no encontrada." };

    var filaDesp = parseInt(dDesp.fila, 10);
    if (!filaDesp || filaDesp < 2) return { status: "error", message: "Referencia de registro a editar inválida." };

    var filaActualDesp = sheetDespEdit.getRange(filaDesp, 1, 1, 8).getValues()[0];
    var idLoteDesp = filaActualDesp[0] ? filaActualDesp[0].toString() : "";
    var provDesp = filaActualDesp[3] ? filaActualDesp[3].toString() : "";
    var prodDesp = filaActualDesp[4] ? filaActualDesp[4].toString() : "";
    var cantidadVieja = parseFloat(filaActualDesp[5]) || 0;

    // Ubicar el lote de origen en Prepagos para reajustar su disponibilidad y tomar su costo/tasa origen
    var dataPreParaDesp = sheetPreParaDesp.getDataRange().getValues();
    var filaLotePre = -1;
    for (var rp = 1; rp < dataPreParaDesp.length; rp++) {
      var idFilaPre = dataPreParaDesp[rp][0] ? dataPreParaDesp[rp][0].toString() : "";
      var prodFilaPre = dataPreParaDesp[rp][2] ? dataPreParaDesp[rp][2].toString() : "";
      if (idFilaPre === idLoteDesp && prodFilaPre === prodDesp) { filaLotePre = rp; break; }
    }
    if (filaLotePre === -1) {
      return { status: "error", message: "No se encontró el lote de origen (" + idLoteDesp + ") para recalcular la disponibilidad." };
    }

    var costoUsdUnitOrigen = parseFloat(dataPreParaDesp[filaLotePre][5]) || 0;
    var tasaOrigenLote = parseFloat(dataPreParaDesp[filaLotePre][8]) || 1;
    var cantDisponibleActualLote = parseFloat(dataPreParaDesp[filaLotePre][4]) || 0;

    var nuevaCantidadDesp = parseFloat(dDesp.cantidad) || 0;
    var deltaCantidad = nuevaCantidadDesp - cantidadVieja; // positivo = se toma MÁS del lote que antes
    var nuevaCantDisponibleLote = cantDisponibleActualLote - deltaCantidad;

    if (nuevaCantDisponibleLote < 0) {
      return {
        status: "error",
        message: "No hay suficiente existencia disponible en el lote " + idLoteDesp + " para subir la cantidad recibida. Disponible actual: " + cantDisponibleActualLote
      };
    }

    var nuevaTasaRecepcion = parseFloat(dDesp.tasaRecepcion) || tasaOrigenLote;
    var nuevoMontoFacturaDesp = nuevaCantidadDesp * costoUsdUnitOrigen * nuevaTasaRecepcion;
    var nuevoTotalOrigenDesp = nuevaCantidadDesp * costoUsdUnitOrigen * tasaOrigenLote;
    var nuevaDifCambiariaDesp = nuevoMontoFacturaDesp - nuevoTotalOrigenDesp;
    var nuevaFechaDesp = parsearFechaLocal(dDesp.fecha);
    var nuevoNroFacturaDesp = dDesp.nroFactura || dDesp.factura || filaActualDesp[1];

    sheetDespEdit.getRange(filaDesp, 1, 1, 8).setValues([[
      idLoteDesp, nuevoNroFacturaDesp, nuevaFechaDesp, provDesp, prodDesp,
      nuevaCantidadDesp, nuevoMontoFacturaDesp, nuevaDifCambiariaDesp
    ]]);

    sheetPreParaDesp.getRange(filaLotePre + 1, 5).setValue(nuevaCantDisponibleLote);

    return { status: "success", message: "Recepción del lote " + idLoteDesp + " actualizada correctamente." };
  }

  return { status: "error", message: "Acción '" + payload.accion + "' no es válida en el servidor." };
}

/**
 * FUNCIONES AUXILIARES
 */

// Calcula el número de lote numérico máximo absoluto + 1
function obtenerSiguienteLote() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Prepagos");
  
  if (!sheet) return "FAB-001";
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "FAB-001";
  
  // Leer los IDs de lote de la columna A
  var lotesValores = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxLote = 0;
  
  for (var i = 0; i < lotesValores.length; i++) {
    var val = lotesValores[i][0];
    if (val) {
      // Extrae solo los números (ejemplo: "FAB-003" -> 3)
      var num = parseInt(val.toString().replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxLote) {
        maxLote = num;
      }
    }
  }
  
  var siguienteNum = maxLote + 1;
  return "FAB-" + ("000" + siguienteNum).slice(-3);
}

// Devuelve los datos iniciales si se ejecuta por google.script.run
function obtenerDatosIniciales() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPre = ss.getSheetByName("Prepagos");
  var sheetProv = ss.getSheetByName("Proveedores");

  var prepagos = [];
  if (sheetPre && sheetPre.getLastRow() > 1) {
    var dataP = sheetPre.getRange(2, 1, sheetPre.getLastRow() - 1, 6).getValues();
    for (var i = 0; i < dataP.length; i++) {
      if (dataP[i][0]) {
        prepagos.push({
          lote: String(dataP[i][0]),
          proveedor: dataP[i][1],
          producto: dataP[i][2],
          cantidad: dataP[i][3],
          costo: dataP[i][4],
          fecha: dataP[i][5]
        });
      }
    }
  }

  var proveedores = [];
  if (sheetProv && sheetProv.getLastRow() > 1) {
    var dataPr = sheetProv.getRange(2, 1, sheetProv.getLastRow() - 1, 2).getValues();
    for (var j = 0; j < dataPr.length; j++) {
      if (dataPr[j][0]) {
        proveedores.push({
          nombre: dataPr[j][0],
          productos: dataPr[j][1]
        });
      }
    }
  }

  return {
    prepagos: prepagos,
    proveedores: proveedores
  };
}

// Parsea fechas de formato YYYY-MM-DD local
function parsearFechaLocal(fechaStr) {
  if (!fechaStr) return new Date();
  var partes = fechaStr.toString().split("-");
  if (partes.length === 3) {
    return new Date(partes[0], partes[1] - 1, partes[2]);
  }
  return new Date();
}
