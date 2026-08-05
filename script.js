const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUTz-A1b6Q2QUZsU_uJC023IWgscqp2Ga-U2WxoORnQuYlLDvebCfIFlYjZBTfb2Ddiw/exec"; //[cite: 4]

let cacheProveedores = []; //[cite: 4]
let cacheHistorialDespachos = []; //[cite: 4]
let cacheUltimosDatos = null; //[cite: 4]
let chartsCargados = false; //[cite: 4]

// Formateador numérico regional (Miles: Punto | Decimales: Coma)
function formatearMonto(valor) {
    const numero = parseFloat(valor); //[cite: 4]
    if (isNaN(numero)) return "0,00"; //[cite: 4]
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero); //[cite: 4]
}

function inicializarGraficos() {
    try {
        if (typeof google !== 'undefined' && google.charts) { //[cite: 4]
            google.charts.load('current', {'packages':['corechart', 'bar']}); //[cite: 4]
            google.charts.setOnLoadCallback(function() { chartsCargados = true; }); //[cite: 4]
        }
    } catch (e) { console.warn("Google Charts no disponible."); } //[cite: 4]
}

function cargarDatos() {
    const elProgreso = document.getElementById('chart-progreso'); //[cite: 4]
    const elDistribucion = document.getElementById('chart-distribucion'); //[cite: 4]
    
    if (elProgreso) elProgreso.innerHTML = "<span class='text-blue-400 animate-pulse'>Sincronizando con Sheets de la Cooperativa...</span>"; //[cite: 4]
    if (elDistribucion) elDistribucion.innerHTML = "<span class='text-blue-400 animate-pulse'>Analizando Lotes...</span>"; //[cite: 4]

    window.procesarRespuestaGoogle = function(resultado) {
        try {
            if (resultado && resultado.status === "success") { //[cite: 4]
                cacheUltimosDatos = resultado; //[cite: 4]
                cacheProveedores = resultado.data.proveedores || []; //[cite: 4]
                cacheHistorialDespachos = resultado.data.historialDespachos || []; //[cite: 4]
                
                renderizarDashboard(resultado.data); //[cite: 4]
                actualizarInterfacesProveedores(); //[cite: 4]
                renderizarTablaReportes(); //[cite: 4]
                configurarFechaPorDefecto(); //[cite: 4]
            }
        } catch (err) { console.error("Error procesando datos:", err); } //[cite: 4]
        const l = document.getElementById('jsonp-script-loader'); if (l) l.remove(); //[cite: 4]
    };

    if (!chartsCargados) inicializarGraficos(); //[cite: 4]

    const script = document.createElement('script'); //[cite: 4]
    script.id = 'jsonp-script-loader'; //[cite: 4]
    script.src = WEB_APP_URL + (WEB_APP_URL.includes('?') ? '&' : '?') + 'callback=procesarRespuestaGoogle'; //[cite: 4]
    script.onerror = function() {
        if (elProgreso) elProgreso.innerText = "⚠️ Error de conexión con Google."; //[cite: 4]
    };
    document.body.appendChild(script); //[cite: 4]
}

function cambiarModulo(idModulo) {
    const target = document.getElementById(idModulo); if (!target) return; //[cite: 4]
    document.querySelectorAll('.modulo').forEach(m => m.classList.add('hidden')); //[cite: 4]
    target.classList.remove('hidden'); //[cite: 4]
    
    document.querySelectorAll('aside nav button').forEach(b => {
        b.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"; //[cite: 4]
    });
    const btn = document.getElementById('nav-' + idModulo); //[cite: 4]
    if (btn) btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white transition"; //[cite: 4]
    
    const titulos = { 
        'mod-dashboard': 'Dashboard General', 
        'mod-prepagos': 'Registrar Prepagos', 
        'mod-recepcion': 'Recepción de Carga', 
        'mod-proveedores': 'Ficha de Proveedores', 
        'mod-reportes': 'Reportes y Auditoría' 
    }; //[cite: 4]
    const titleDom = document.getElementById('titulo-modulo'); if (titleDom) titleDom.innerText = titulos[idModulo] || 'Sistema'; //[cite: 4]
    if (idModulo === 'mod-dashboard') cargarDatos(); //[cite: 4]
}

function agregarCampoMercancia() {
    const div = document.createElement('div'); div.className = "flex gap-2 mt-1"; //[cite: 4]
    div.innerHTML = `<input type="text" class="input-mercancia w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" placeholder="Producto" required><button type="button" onclick="this.parentElement.remove()" class="bg-red-900/80 text-red-200 px-3 rounded-lg font-bold hover:bg-red-800 text-xs">-</button>`; //[cite: 4]
    document.getElementById('contenedor-mercancias').appendChild(div); //[cite: 4]
}

function actualizarInterfacesProveedores() {
    document.querySelectorAll('.select-proveedores').forEach(sel => {
        const val = sel.value; //[cite: 4]
        sel.innerHTML = '<option value="">-- Seleccione un proveedor --</option>'; //[cite: 4]
        cacheProveedores.forEach(p => sel.innerHTML += `<option value="${p.nombre}">${p.nombre}</option>`); //[cite: 4]
        if (val) sel.value = val; //[cite: 4]
    });

    const lista = document.getElementById('lista-proveedores-completa'); //[cite: 4]
    if (lista) {
        lista.innerHTML = ""; //[cite: 4]
        cacheProveedores.forEach(p => {
            const prods = Array.isArray(p.productos) ? p.productos : []; //[cite: 4]
            const chips = prods.map(pr => `<span class="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700">${pr}</span>`).join(' '); //[cite: 4]
            lista.innerHTML += `<div class="p-3 bg-slate-950 rounded-lg border border-slate-800"><p class="font-bold text-sm text-white">${p.nombre}</p><div class="flex flex-wrap gap-1 mt-2">${chips || '<span class="text-xs text-slate-600 italic">Sin mercancía</span>'}</div></div>`; //[cite: 4]
        });
    }
}

function filtrarProductosPorProveedor(prov, idDestino) {
    const dest = document.getElementById(idDestino); if (!dest) return; //[cite: 4]
    dest.innerHTML = ""; //[cite: 4]
    if (!prov) { dest.innerHTML = '<option value="">-- Seleccione primero un proveedor --</option>'; return; } //[cite: 4]
    const item = cacheProveedores.find(p => p.nombre === prov); //[cite: 4]
    if (item && Array.isArray(item.productos) && item.productos.length > 0) {
        dest.innerHTML = '<option value="">-- Seleccione Mercancía --</option>'; //[cite: 4]
        item.productos.forEach(pr => dest.innerHTML += `<option value="${pr}">${pr}</option>`); //[cite: 4]
    } else { dest.innerHTML = '<option value="">⚠️ Sin mercancía registrada</option>'; } //[cite: 4]
}

function renderizarDashboard(data) {
    let p = 0, pe = 0, r = 0; //[cite: 4]
    const tbody = document.getElementById("tabla-lotes"); if (!tbody) return; //[cite: 4]
    tbody.innerHTML = ""; //[cite: 4]
    
    if (!data.detallesLotes || data.detallesLotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-xs text-slate-500 italic">No hay lotes activos registrados</td></tr>`; //[cite: 4]
        return;
    }

    data.detallesLotes.forEach(l => {
        const rec = l.cantOriginal - l.cantDisponible; p += l.cantOriginal; pe += l.cantDisponible; r += rec; //[cite: 4]
        tbody.insertAdjacentHTML("beforeend", `
            <tr class="hover:bg-slate-900/50 border-b border-slate-800">
                <td class="px-6 py-4 font-mono text-xs font-bold text-blue-400">${l.idLote}</td>
                <td class="px-6 py-4 font-medium">${l.proveedor}</td>
                <td class="px-6 py-4">${l.producto}</td>
                <td class="px-6 py-4 text-right font-mono">${formatearMonto(l.cantOriginal)}</td>
                <td class="px-6 py-4 text-right font-mono font-bold text-amber-400">${formatearMonto(l.cantDisponible)}</td>
            </tr>
        `); //[cite: 4]
    });

    if (document.getElementById("kpi-prepagado")) document.getElementById("kpi-prepagado").innerText = formatearMonto(p); //[cite: 4]
    if (document.getElementById("kpi-recibido")) document.getElementById("kpi-recibido").innerText = formatearMonto(r); //[cite: 4]
    if (document.getElementById("kpi-pendiente")) document.getElementById("kpi-pendiente").innerText = formatearMonto(pe); //[cite: 4]
    
    if (chartsCargados && data.resumenConsolidated) dibujarGraficos(data.resumenConsolidated); //[cite: 4]
}

function dibujarGraficos(resumen) {
    try {
        const pDom = document.getElementById('chart-progreso'); //[cite: 4]
        const dDom = document.getElementById('chart-distribucion'); //[cite: 4]
        if (!pDom || !dDom) return; //[cite: 4]

        const dtP = new google.visualization.DataTable(); //[cite: 4]
        dtP.addColumn('string', 'Proveedor'); dtP.addColumn('number', 'Recibido'); dtP.addColumn('number', 'Pendiente'); //[cite: 4]
        const dtT = [['Proveedor', 'Pendiente']]; //[cite: 4]
        resumen.forEach(r => { dtP.addRow([r.proveedor, r.totalRecibido, r.totalPendiente]); dtT.push([r.proveedor, r.totalPendiente]); }); //[cite: 4]
        
        const opt = { backgroundColor: 'transparent', legend: {textStyle:{color:'#94a3b8'}}, chartArea: {width: '80%', height: '80%'}, hAxis:{textStyle:{color:'#64748b'}}, vAxis:{textStyle:{color:'#64748b'}} }; //[cite: 4]
        new google.visualization.BarChart(pDom).draw(dtP, { ...opt, isStacked: true, colors: ['#10b981', '#f59e0b'] }); //[cite: 4]
        new google.visualization.PieChart(dDom).draw(google.visualization.arrayToDataTable(dtT), { ...opt, colors: ['#3b82f6', '#f59e0b', '#ef4444'], pieHole: 0.4 }); //[cite: 4]
    } catch (e) {}
}

function configurarFechaPorDefecto() {
    const el = document.getElementById("pre-fecha"); //[cite: 4]
    if (el && !el.value) {
        const hoy = new Date().toISOString().split('T')[0]; //[cite: 4]
        el.value = hoy; //[cite: 4]
    }
    const elRec = document.getElementById("rec-fecha"); //[cite: 4]
    if (elRec && !elRec.value) {
        const hoy = new Date().toISOString().split('T')[0]; //[cite: 4]
        elRec.value = hoy; //[cite: 4]
    }
}

function actualizarFlujoProveedorPrepago(prov) {
    const container = document.getElementById("contenedor-items-prepago"); //[cite: 4]
    container.innerHTML = ""; //[cite: 4]
    
    if (!prov) {
        document.getElementById("pre-lote-sugerido").innerText = "AUTO-GEN"; //[cite: 4]
        return;
    }

    let correlativo = 1; //[cite: 4]
    if (cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.detallesLotes) {
        const filtrados = cacheUltimosDatos.data.detallesLotes.filter(x => x.proveedor === prov); //[cite: 4]
        correlativo = filtrados.length + 1; //[cite: 4]
    }
    const iniciales = prov.substring(0, 3).toUpperCase(); //[cite: 4]
    document.getElementById("pre-lote-sugerido").innerText = `${iniciales}-${String(correlativo).padStart(3, '0')}`; //[cite: 4]

    agregarFilaMercanciaPrepago(); //[cite: 4]
}

function agregarFilaMercanciaPrepago() {
    const prov = document.getElementById("pre-proveedor").value; //[cite: 4]
    if (!prov) { alert("Por favor, seleccione primero un proveedor."); return; } //[cite: 4]

    const pData = cacheProveedores.find(x => x.nombre === prov); //[cite: 4]
    const productos = (pData && pData.productos) ? pData.productos : []; //[cite: 4]
    
    const tr = document.createElement('tr'); //[cite: 4]
    tr.className = "item-fila-prepago bg-slate-950/40 hover:bg-slate-900/40 transition"; //[cite: 4]
    
    let opcionesHtml = `<option value="">Seleccione...</option>`; //[cite: 4]
    productos.forEach(pr => opcionesHtml += `<option value="${pr}">${pr}</option>`); //[cite: 4]

    tr.innerHTML = `
        <td class="p-2">
            <select class="item-producto w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white" required>
                ${opcionesHtml}
            </select>
        </td>
        <td class="p-2">
            <input type="number" step="1" class="item-cantidad w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-xs text-white" placeholder="0" oninput="calcularTotalesPrepago()" required>
        </td>
        <td class="p-2">
            <input type="number" step="0.01" class="item-costo-usd w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-xs text-white" placeholder="0.00" oninput="calcularTotalesPrepago()" required>
        </td>
        <td class="p-2 text-right font-mono text-xs text-slate-400 font-bold item-total-usd-txt">0,00</td>
        <td class="p-2 text-right font-mono text-xs text-blue-400 font-bold item-total-bs-txt">0,00</td>
        <td class="p-2 text-center">
            <button type="button" onclick="this.parentElement.parentElement.remove(); calcularTotalesPrepago();" class="text-red-500 hover:text-red-400 font-bold text-sm">✕</button>
        </td>
    `; //[cite: 4]
    document.getElementById("contenedor-items-prepago").appendChild(tr); //[cite: 4]
    calcularTotalesPrepago(); //[cite: 4]
}

function calcularTotalesPrepago() {
    const tasa = parseFloat(document.getElementById("pre-tasa").value) || 0; //[cite: 4]
    let sumatoriaUsd = 0; //[cite: 4]

    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const cant = parseFloat(fila.querySelector(".item-cantidad").value) || 0; //[cite: 4]
        const costoUsd = parseFloat(fila.querySelector(".item-costo-usd").value) || 0; //[cite: 4]
        
        const tUsd = cant * costoUsd; //[cite: 4]
        const tBs = tUsd * tasa; //[cite: 4]
        sumatoriaUsd += tUsd; //[cite: 4]

        fila.querySelector(".item-total-usd-txt").innerText = formatearMonto(tUsd); //[cite: 4]
        fila.querySelector(".item-total-bs-txt").innerText = formatearMonto(tBs); //[cite: 4]
    });

    const totalBsObligatorio = sumatoriaUsd * tasa; //[cite: 4]

    let sumatoriaBancos = 0; //[cite: 4]
    document.querySelectorAll(".input-banco-prepago").forEach(inp => {
        if (!inp.dataset.listenerAsignado) {
            inp.addEventListener("input", calcularTotalesPrepago); //[cite: 4]
            inp.dataset.listenerAsignado = "true"; //[cite: 4]
        }
        sumatoriaBancos += parseFloat(inp.value) || 0; //[cite: 4]
    });

    const diferencia = totalBsObligatorio - sumatoriaBancos; //[cite: 4]

    document.getElementById("txt-total-usd").innerText = formatearMonto(sumatoriaUsd); //[cite: 4]
    document.getElementById("txt-total-bs").innerText = formatearMonto(totalBsObligatorio); //[cite: 4]
    document.getElementById("txt-total-bancos").innerText = formatearMonto(sumatoriaBancos); //[cite: 4]
    
    const txtDiffEl = document.getElementById("txt-diferencia"); //[cite: 4]
    if (txtDiffEl) txtDiffEl.innerText = formatearMonto(Math.abs(diferencia)); //[cite: 4]

    const wrapperDiff = document.getElementById("wrapper-diferencia"); //[cite: 4]
    const btnGuardar = document.getElementById("btn-guardar-prepago"); //[cite: 4]
    const btnImprimir = document.getElementById("btn-imprimir-prepago"); //[cite: 4]

    if (totalBsObligatorio > 0 && Math.abs(diferencia) <= 1) {
        wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-400"; //[cite: 4]
        wrapperDiff.innerText = "✅ Cuadrado / Conciliación Bancaria Exitosa"; //[cite: 4]
        
        btnGuardar.disabled = false; //[cite: 4]
        btnGuardar.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center"; //[cite: 4]
        
        btnImprimir.disabled = false; //[cite: 4]
        btnImprimir.className = "bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1 w-full"; //[cite: 4]
    } else {
        wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-xs bg-red-950/60 border border-red-800 text-red-400"; //[cite: 4]
        
        if (diferencia >= 0) {
            wrapperDiff.innerHTML = `Falta por conciliar: <span class="font-mono">${formatearMonto(diferencia)}</span> Bs`; //[cite: 4]
        } else {
            wrapperDiff.innerHTML = `Monto excedido en bancos: <span class="font-mono">${formatearMonto(Math.abs(diferencia))}</span> Bs`; //[cite: 4]
        }
        
        btnGuardar.disabled = true; //[cite: 4]
        btnGuardar.className = "bg-blue-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full"; //[cite: 4]
        
        btnImprimir.disabled = true; //[cite: 4]
        btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full"; //[cite: 4]
    }
}

function imprimirReciboPrepago() {
    const prov = document.getElementById("pre-proveedor").value; //[cite: 4]
    const lote = document.getElementById("pre-lote-sugerido").innerText; //[cite: 4]
    const tasa = parseFloat(document.getElementById("pre-tasa").value) || 1; //[cite: 4]
    const fecha = document.getElementById("pre-fecha").value; //[cite: 4]
    
    let htmlItems = ""; //[cite: 4]
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const prod = fila.querySelector(".item-producto").value; //[cite: 4]
        const cant = parseFloat(fila.querySelector(".item-cantidad").value) || 0; //[cite: 4]
        const cost = parseFloat(fila.querySelector(".item-costo-usd").value) || 0; //[cite: 4]
        const totUsd = cant * cost; //[cite: 4]
        const totBs = totUsd * tasa; //[cite: 4]
        htmlItems += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; text-align: left; color: #334155;">${prod}</td>
                <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${cant}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace;">$${formatearMonto(cost)}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #1e293b;">$${formatearMonto(totUsd)}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; color: #2563eb;">Bs. ${formatearMonto(totBs)}</td>
            </tr>`; //[cite: 4]
    });

    let htmlBancos = ""; //[cite: 4]
    const bancosMapeados = [
        { id: "pago-banesco", label: "BANESCO" },
        { id: "pago-mercantil", label: "MERCANTIL" },
        { id: "pago-provincial", label: "PROVINCIAL" },
        { id: "pago-bancaribe", label: "BANCARIBE" },
        { id: "pago-activo", label: "BANCO ACTIVO" }
    ]; //[cite: 4]

    bancosMapeados.forEach(b => {
        const val = parseFloat(document.getElementById(b.id).value) || 0; //[cite: 4]
        if (val > 0) {
            htmlBancos += `
                <tr>
                    <td style="padding: 6px 0; color: #475569; font-size: 13px;">• Débito cuenta ${b.label}:</td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; color: #0f766e; font-size: 13px;">Bs. ${formatearMonto(val)}</td>
                </tr>`; //[cite: 4]
        }
    });

    const tUsd = document.getElementById("txt-total-usd").innerText; //[cite: 4]
    const tBs = document.getElementById("txt-total-bs").innerText; //[cite: 4]

    const ventanaImpresion = window.open('', '_blank', 'width=850,height=1100'); //[cite: 4]
    ventanaImpresion.document.write(`
        <html>
        <head>
            <title>Soporte Operacional - Lote ${lote}</title>
            <style>
                @page { size: letter; margin: 45px; }
                body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #1e293b; background: white; margin: 0; padding: 0; font-size: 14px; }
                .wrapper { width: 100%; max-width: 750px; margin: 0 auto; }
                .table-info { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; width: 48%; vertical-align: top; }
                .table-main { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .table-main th { background: #1e3a8a; color: white; padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                .firma-linea { border-top: 1px solid #94a3b8; width: 200px; margin-top: 50px; text-align: center; font-size: 12px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <table style="width:100%; border-collapse:collapse; margin-bottom: 20px;">
                    <tr>
                        <td>
                            <h2 style="margin:0; color:#1e3a8a; font-size:26px; font-weight:800; letter-spacing:-0.5px;">SICOOP COOPERATIVA</h2>
                            <p style="margin:2px 0 0 0; color:#64748b; font-size:11px; text-transform:uppercase; font-weight:600; letter-spacing:1px;">Gestión y Control de Inventarios Indexados</p>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                            <div style="border: 2px solid #1e3a8a; padding: 10px 20px; border-radius: 6px; display: inline-block; background:#f0f4ff;">
                                <span style="display:block; font-size:10px; color:#1e3a8a; font-weight:700; text-align:center; text-transform:uppercase;">Comprobante de Movimiento</span>
                                <span style="font-family:monospace; font-size:16px; font-weight:bold; color:#111827;">LOTE: ${lote}</span>
                            </div>
                        </td>
                    </tr>
                </table>

                <hr style="border:0; border-top: 1px solid #e2e8f0; margin-bottom:25px;">

                <table class="table-info">
                    <tr>
                        <td class="info-card">
                            <h4 style="margin:0 0 8px 0; color:#1e3a8a; font-size:12px; text-transform:uppercase; border-bottom:2px solid #e2e8f0; padding-bottom:3px;">Información del Proveedor</h4>
                            <table style="width:100%; font-size:13px; line-height:1.8;">
                                <tr><td style="color:#64748b;">Razón Social:</td><td style="font-weight:700; color:#0f172a;">${prov}</td></tr>
                                <tr><td style="color:#64748b;">Estatus Lote:</td><td><span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Pre-pagado Activo</span></td></tr>
                            </table>
                        </td>
                        <td style="width:4%;"></td>
                        <td class="info-card">
                            <h4 style="margin:0 0 8px 0; color:#1e3a8a; font-size:12px; text-transform:uppercase; border-bottom:2px solid #e2e8f0; padding-bottom:3px;">Datos de Auditoría</h4>
                            <table style="width:100%; font-size:13px; line-height:1.8;">
                                <tr><td style="color:#64748b;">Fecha Emisión:</td><td style="font-weight:600;">${fecha}</td></tr>
                                <tr><td style="color:#64748b;">Tasa Fiscal Ref:</td><td style="font-weight:bold; font-family:monospace;">Bs. ${formatearMonto(tasa)}</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <h3 style="font-size:13px; color:#475569; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.5px;">1. Desglose Computado de Bienes Adquiridos</h3>
                <table class="table-main">
                    <thead>
                        <tr>
                            <th style="text-align:left; border-top-left-radius:4px;">Descripción del Item</th>
                            <th style="width:10%; text-align:center;">Cant.</th>
                            <th style="width:16%; text-align:right;">Costo Unit ($)</th>
                            <th style="width:18%; text-align:right;">Total Neto ($)</th>
                            <th style="width:22%; text-align:right; border-top-right-radius:4px;">Equiv. Líquido (Bs.)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlItems}
                    </tbody>
                </table>

                <table style="width:40%; margin-left:auto; border-collapse:collapse; margin-top:15px; margin-bottom:30px;">
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size:13px;">Valor FOB Total ($):</td>
                        <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: 600;">$${tUsd}</td>
                    </tr>
                    <tr style="border-top: 1px dashed #cbd5e1;">
                        <td style="padding: 8px 0; color: #1e3a8a; font-weight: bold; font-size:14px;">Total en Bolívares:</td>
                        <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold; color: #2563eb; font-size:15px;">Bs. ${tBs}</td>
                    </tr>
                </table>

                <h3 style="font-size:13px; color:#475569; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.5px;">2. Origen de Fondos y Conciliación Bancaria</h3>
                <table style="width: 50%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; background:#fafafa;">
                    <tr style="background:#e2e8f0; color:#334155; font-size:11px; font-weight:bold; text-transform:uppercase;">
                        <td style="padding:8px; text-align:left;">Banco Emisor</td>
                        <td style="padding:8px; text-align:right;">Monto Debitado</td>
                    </tr>
                    ${htmlBancos}
                </table>

                <table style="width:100%; margin-top:80px; border-collapse:collapse;">
                    <tr>
                        <td style="width:50%; text-align:center;">
                            <div class="firma-linea" style="margin: 0 auto;">Preparado por: Control Operativo</div>
                        </td>
                        <td style="width:50%; text-align:center;">
                            <div class="firma-linea" style="margin: 0 auto;">Recibido Conforme / Proveedor</div>
                        </td>
                    </tr>
                </table>

                <div style="margin-top:70px; border-top:1px solid #e2e8f0; padding-top:10px; text-align:center; font-size:11px; color:#94a3b8;">
                    SICOOP Web Corporativo v2.5 • Este comprobante ratifica el desglose del prepago para la carga en inventario mediante asignación por lote FIFO.
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            <\/script>
        </body>
        </html>
    `); //[cite: 4]
    ventanaImpresion.document.close(); //[cite: 4]
}

function procesarEnvioPrepago(e) {
    e.preventDefault(); //[cite: 4]
    const btn = document.getElementById("btn-guardar-prepago"); //[cite: 4]
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Guardando..."; } //[cite: 4]

    const items = []; //[cite: 4]
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        items.push({
            producto: fila.querySelector(".item-producto").value,
            cantidad: parseFloat(fila.querySelector(".item-cantidad").value) || 0,
            costoUsd: parseFloat(fila.querySelector(".item-costo-usd").value) || 0
        }); //[cite: 4]
    });

    const payload = {
        accion: "registrar_prepago_consolidado",
        data: {
            idLote: document.getElementById("pre-lote-sugerido").innerText,
            proveedor: document.getElementById("pre-proveedor").value,
            fecha: document.getElementById("pre-fecha").value,
            tasa: parseFloat(document.getElementById("pre-tasa").value) || 1,
            items: items,
            bancos: {
                BANESCO: parseFloat(document.getElementById("pago-banesco").value) || 0,
                MERCANTIL: parseFloat(document.getElementById("pago-mercantil").value) || 0,
                PROVINCIAL: parseFloat(document.getElementById("pago-provincial").value) || 0,
                BANCARIBE: parseFloat(document.getElementById("pago-bancaribe").value) || 0,
                BANCO_ACTIVO: parseFloat(document.getElementById("pago-activo").value) || 0
            }
        }
    }; //[cite: 4]

    window.respuestaGuardadoGoogle = function(res) {
        if (res && res.status === "success") { //[cite: 4]
            imprimirReciboPrepago(); //[cite: 4]
            alert(`🚀 Transmisión limpia: Lote ${payload.data.idLote} guardado con éxito.`); //[cite: 4]
            document.getElementById("form-prepago").reset(); //[cite: 4]
            document.getElementById("contenedor-items-prepago").innerHTML = ""; //[cite: 4]
            calcularTotalesPrepago(); //[cite: 4]
            cambiarModulo("mod-dashboard"); //[cite: 4]
        } else {
            alert("⚠️ " + (res && res.message ? res.message : "El servidor devolvió una alerta.")); //[cite: 4]
            if (btn) { btn.disabled = false; btn.innerText = "💾 Procesar Guardado"; } //[cite: 4]
        }
        const loader = document.getElementById('jsonp-guardar-loader'); //[cite: 4]
        if (loader) loader.remove(); //[cite: 4]
    };

    const scriptEnvio = document.createElement('script'); //[cite: 4]
    scriptEnvio.id = 'jsonp-guardar-loader'; //[cite: 4]
    const datosSerializados = encodeURIComponent(JSON.stringify(payload)); //[cite: 4]
    scriptEnvio.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaGuardadoGoogle&payload=${datosSerializados}`; //[cite: 4]
    
    scriptEnvio.onerror = function() {
        alert("❌ Error de red al comunicarse con Google Apps Script."); //[cite: 4]
        if (btn) { btn.disabled = false; btn.innerText = "💾 Procesar Guardado"; } //[cite: 4]
        const loader = document.getElementById('jsonp-guardar-loader'); //[cite: 4]
        if (loader) loader.remove(); //[cite: 4]
    };

    document.body.appendChild(scriptEnvio); //[cite: 4]
}

// RECEPCIÓN DE CARGA Y MOTOR FIFO CASCADA
function actualizarFlujoProveedorRecepcion(prov) {
    filtrarProductosPorProveedor(prov, "rec-producto"); //[cite: 4]
    actualizarTablaRecepcionCascada(); //[cite: 4]
}

/**
 * Función que recalcula la tabla FIFO y asigna directamente el valor de 'rec-monto-bs' al elemento KPI 'rec-kpi-bs-actual'
 */
function actualizarTablaRecepcionCascada() {
    // 1. Asignar directamente el valor de 'rec-monto-bs' hacia el elemento 'rec-kpi-bs-actual'
    const inputMontoBs = document.getElementById("rec-monto-bs");
    const elKpiBsActual = document.getElementById("rec-kpi-bs-actual");
    const valorBsDirecto = parseFloat(inputMontoBs ? inputMontoBs.value : 0) || 0;

    if (elKpiBsActual) {
        if ('value' in elKpiBsActual) {
            elKpiBsActual.value = valorBsDirecto;
        } else {
            elKpiBsActual.innerText = formatearMonto(valorBsDirecto);
        }
    }

    // 2. Lógica del motor FIFO y actualización de la tabla
    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : ""; //[cite: 4]
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : ""; //[cite: 4]
    const cantRecepcion = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0; //[cite: 4]
    const tasaActual = parseFloat(document.getElementById("rec-tasa") ? document.getElementById("rec-tasa").value : 0) || 0; //[cite: 4]

    const tbody = document.getElementById("rec-tabla-lotes-body"); //[cite: 4]
    if (!tbody) return; //[cite: 4]
    tbody.innerHTML = ""; //[cite: 4]

    if (!prov || !prod || !cacheUltimosDatos || !cacheUltimosDatos.data || !cacheUltimosDatos.data.detallesLotes) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-slate-500 italic">Seleccione proveedor y producto para cargar desglose FIFO</td></tr>`; //[cite: 4]
        resetearKPIsRecepcion(); //[cite: 4]
        return;
    }

    const lotesDisponibles = cacheUltimosDatos.data.detallesLotes.filter(l => 
        l.proveedor === prov && 
        l.producto === prod && 
        l.cantDisponible > 0
    ); //[cite: 4]

    if (lotesDisponibles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-amber-500 italic">⚠️ No hay lotes pendientes para este producto</td></tr>`; //[cite: 4]
        resetearKPIsRecepcion(); //[cite: 4]
        return;
    }

    let remanentePorDespachar = cantRecepcion; //[cite: 4]
    let sumUsdOriginal = 0; //[cite: 4]
    let sumBsOriginal = 0; //[cite: 4]
    let sumBsActual = 0; //[cite: 4]

    lotesDisponibles.forEach(lote => {
        const cantDisponible = lote.cantDisponible; //[cite: 4]
        let cantTomada = 0; //[cite: 4]

        if (remanentePorDespachar > 0) {
            cantTomada = Math.min(remanentePorDespachar, cantDisponible); //[cite: 4]
            remanentePorDespachar -= cantTomada; //[cite: 4]
        }

        const costoUsdUnit = lote.costoUsd || 0; //[cite: 4]
        const tasaOrigen = lote.tasaOriginal || 0; //[cite: 4]

        const totalUsdTomado = cantTomada * costoUsdUnit; //[cite: 4]
        const totalBsOrigenTomado = totalUsdTomado * tasaOrigen; //[cite: 4]
        const totalBsActualTomado = totalUsdTomado * tasaActual; //[cite: 4]

        sumUsdOriginal += totalUsdTomado; //[cite: 4]
        sumBsOriginal += totalBsOrigenTomado; //[cite: 4]
        sumBsActual += totalBsActualTomado; //[cite: 4]

        const row = document.createElement("tr"); //[cite: 4]
        row.className = cantTomada > 0 ? "bg-blue-950/30 border-b border-slate-800" : "opacity-40 border-b border-slate-800"; //[cite: 4]
        row.innerHTML = `
            <td class="px-3 py-2 font-mono text-xs font-bold text-blue-400">${lote.idLote}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">${formatearMonto(cantDisponible)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-emerald-400 font-bold">${formatearMonto(cantTomada)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">$${formatearMonto(costoUsdUnit)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right font-bold text-slate-200">$${formatearMonto(totalUsdTomado)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">Bs. ${formatearMonto(tasaOrigen)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-slate-300">Bs. ${formatearMonto(totalBsOrigenTomado)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-blue-400 font-bold">Bs. ${formatearMonto(totalBsActualTomado)}</td>
        `; //[cite: 4]
        tbody.appendChild(row); //[cite: 4]
    });

    const ajusteValorizacionBs = sumBsActual - sumBsOriginal; //[cite: 4]
    
    if (document.getElementById("rec-kpi-usd")) document.getElementById("rec-kpi-usd").innerText = formatearMonto(sumUsdOriginal); //[cite: 4]
    if (document.getElementById("rec-kpi-bs-origen")) document.getElementById("rec-kpi-bs-origen").innerText = formatearMonto(sumBsOriginal); //[cite: 4]
    
    const kpiAjusteEl = document.getElementById("rec-kpi-ajuste"); //[cite: 4]
    if (kpiAjusteEl) {
        kpiAjusteEl.innerText = `${ajusteValorizacionBs >= 0 ? '+' : ''}${formatearMonto(ajusteValorizacionBs)} Bs`; //[cite: 4]
        kpiAjusteEl.className = `font-mono text-lg font-bold ${ajusteValorizacionBs >= 0 ? 'text-emerald-400' : 'text-red-400'}`; //[cite: 4]
    }

    const btnProcesar = document.getElementById("btn-guardar-recepcion"); //[cite: 4]
    const btnImprimir = document.getElementById("btn-imprimir-recepcion"); //[cite: 4]

    if (remanentePorDespachar > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = true; //[cite: 4]
            btnProcesar.className = "bg-amber-600/50 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full"; //[cite: 4]
            btnProcesar.innerText = `⚠️ Stock insuficiente (Faltan: ${formatearMonto(remanentePorDespachar)} und)`; //[cite: 4]
        }
        if (btnImprimir) {
            btnImprimir.disabled = true; //[cite: 4]
            btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full"; //[cite: 4]
        }
    } else if (cantRecepcion > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = false; //[cite: 4]
            btnProcesar.className = "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center"; //[cite: 4]
            btnProcesar.innerText = "📦 Confirmar Recepción de Carga"; //[cite: 4]
        }
        if (btnImprimir) {
            btnImprimir.disabled = false; //[cite: 4]
            btnImprimir.className = "bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1 w-full"; //[cite: 4]
        }
    } else {
        if (btnProcesar) {
            btnProcesar.disabled = true; //[cite: 4]
            btnProcesar.className = "bg-emerald-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full"; //[cite: 4]
            btnProcesar.innerText = "📦 Confirmar Recepción de Carga"; //[cite: 4]
        }
        if (btnImprimir) {
            btnImprimir.disabled = true; //[cite: 4]
            btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full"; //[cite: 4]
        }
    }
}

function resetearKPIsRecepcion() {
    if (document.getElementById("rec-kpi-usd")) document.getElementById("rec-kpi-usd").innerText = "0,00"; //[cite: 4]
    if (document.getElementById("rec-kpi-bs-origen")) document.getElementById("rec-kpi-bs-origen").innerText = "0,00"; //[cite: 4]
    if (document.getElementById("rec-kpi-bs-actual")) {
        const el = document.getElementById("rec-kpi-bs-actual");
        if ('value' in el) el.value = "0";
        else el.innerText = "0,00";
    }
    if (document.getElementById("rec-kpi-ajuste")) {
        document.getElementById("rec-kpi-ajuste").innerText = "0,00 Bs"; //[cite: 4]
        document.getElementById("rec-kpi-ajuste").className = "font-mono text-lg font-bold text-slate-400"; //[cite: 4]
    }
    const btn = document.getElementById("btn-guardar-recepcion"); //[cite: 4]
    if (btn) {
        btn.disabled = true; //[cite: 4]
        btn.className = "bg-emerald-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full"; //[cite: 4]
        btn.innerText = "📦 Confirmar Recepción de Carga"; //[cite: 4]
    }
    const btnImp = document.getElementById("btn-imprimir-recepcion"); //[cite: 4]
    if (btnImp) {
        btnImp.disabled = true; //[cite: 4]
        btnImp.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full"; //[cite: 4]
    }
}

// IMPRESIÓN COMPROBANTE RECEPCIÓN DE CARGA
function imprimirComprobanteRecepcion() {
    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : ""; //[cite: 4]
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : ""; //[cite: 4]
    const cant = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0; //[cite: 4]
    const fecha = document.getElementById("rec-fecha") ? document.getElementById("rec-fecha").value : new Date().toISOString().split('T')[0]; //[cite: 4]
    const tasaActual = parseFloat(document.getElementById("rec-tasa") ? document.getElementById("rec-tasa").value : 1) || 1; //[cite: 4]
    
    const numFacturaInput = document.getElementById("rec-guia") || document.getElementById("rec-factura") || document.querySelector('input[placeholder*="FACTURA"]'); //[cite: 4]
    const factura = numFacturaInput ? numFacturaInput.value : "N/A"; //[cite: 4]

    const kpiUsd = document.getElementById("rec-kpi-usd") ? document.getElementById("rec-kpi-usd").innerText : "0,00"; //[cite: 4]
    const kpiBsOrigen = document.getElementById("rec-kpi-bs-origen") ? document.getElementById("rec-kpi-bs-origen").innerText : "0,00"; //[cite: 4]
    
    const elBsActual = document.getElementById("rec-kpi-bs-actual");
    const kpiBsActual = elBsActual ? ('value' in elBsActual ? elBsActual.value : elBsActual.innerText) : "0,00";
    
    const kpiAjuste = document.getElementById("rec-kpi-ajuste") ? document.getElementById("rec-kpi-ajuste").innerText : "0,00 Bs"; //[cite: 4]

    let htmlFilasFifo = ""; //[cite: 4]
    const tbody = document.getElementById("rec-tabla-lotes-body"); //[cite: 4]
    if (tbody) {
        const trs = tbody.querySelectorAll("tr"); //[cite: 4]
        trs.forEach(tr => {
            const cols = tr.querySelectorAll("td"); //[cite: 4]
            if (cols.length >= 8) {
                const idLote = cols[0].innerText; //[cite: 4]
                const cantTomada = cols[2].innerText; //[cite: 4]
                const costoUsd = cols[3].innerText; //[cite: 4]
                const totalUsd = cols[4].innerText; //[cite: 4]
                const tasaOrigen = cols[5].innerText; //[cite: 4]
                const totalBsOrigen = cols[6].innerText; //[cite: 4]
                const totalBsActual = cols[7].innerText; //[cite: 4]

                htmlFilasFifo += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #1e3a8a;">${idLote}</td>
                        <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; color: #047857;">${cantTomada}</td>
                        <td style="padding: 8px; text-align: right; font-family: monospace;">${costoUsd}</td>
                        <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold;">${totalUsd}</td>
                        <td style="padding: 8px; text-align: right; font-family: monospace; color: #64748b;">${tasaOrigen}</td>
                        <td style="padding: 8px; text-align: right; font-family: monospace; color: #475569;">${totalBsOrigen}</td>
                        <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; color: #2563eb;">${totalBsActual}</td>
                    </tr>
                `; //[cite: 4]
            }
        });
    }

    const ventanaImpresion = window.open('', '_blank', 'width=850,height=1100'); //[cite: 4]
    ventanaImpresion.document.write(`
        <html>
        <head>
            <title>Comprobante Recepción de Carga - Factura ${factura}</title>
            <style>
                @page { size: letter; margin: 45px; }
                body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #1e293b; background: white; margin: 0; padding: 0; font-size: 13px; }
                .wrapper { width: 100%; max-width: 750px; margin: 0 auto; }
                .table-info { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; width: 48%; vertical-align: top; }
                .table-main { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .table-main th { background: #047857; color: white; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
                .firma-linea { border-top: 1px solid #94a3b8; width: 200px; margin-top: 50px; text-align: center; font-size: 11px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <table style="width:100%; border-collapse:collapse; margin-bottom: 15px;">
                    <tr>
                        <td>
                            <h2 style="margin:0; color:#047857; font-size:24px; font-weight:800; letter-spacing:-0.5px;">SICOOP COOPERATIVA</h2>
                            <p style="margin:2px 0 0 0; color:#64748b; font-size:11px; text-transform:uppercase; font-weight:600;">Comprobante de Recepción y Descargo FIFO</p>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                            <div style="border: 2px solid #047857; padding: 8px 16px; border-radius: 6px; display: inline-block; background:#f0fdf4;">
                                <span style="display:block; font-size:10px; color:#047857; font-weight:700; text-align:center; text-transform:uppercase;">N° Factura / Guía</span>
                                <span style="font-family:monospace; font-size:16px; font-weight:bold; color:#111827;">${factura}</span>
                            </div>
                        </td>
                    </tr>
                </table>

                <hr style="border:0; border-top: 1px solid #e2e8f0; margin-bottom:20px;">

                <table class="table-info">
                    <tr>
                        <td class="info-card">
                            <h4 style="margin:0 0 6px 0; color:#047857; font-size:11px; text-transform:uppercase; border-bottom:2px solid #e2e8f0; padding-bottom:3px;">Datos de Recepción</h4>
                            <table style="width:100%; font-size:12px; line-height:1.7;">
                                <tr><td style="color:#64748b;">Proveedor:</td><td style="font-weight:700; color:#0f172a;">${prov}</td></tr>
                                <tr><td style="color:#64748b;">Producto:</td><td style="font-weight:600;">${prod}</td></tr>
                                <tr><td style="color:#64748b;">Cant. Recibida:</td><td style="font-weight:bold; font-family:monospace; color:#047857;">${formatearMonto(cant)} und</td></tr>
                            </table>
                        </td>
                        <td style="width:4%;"></td>
                        <td class="info-card">
                            <h4 style="margin:0 0 6px 0; color:#047857; font-size:11px; text-transform:uppercase; border-bottom:2px solid #e2e8f0; padding-bottom:3px;">Parámetros de Liquidación</h4>
                            <table style="width:100%; font-size:12px; line-height:1.7;">
                                <tr><td style="color:#64748b;">Fecha Recepción:</td><td style="font-weight:600;">${fecha}</td></tr>
                                <tr><td style="color:#64748b;">Tasa Liquidación:</td><td style="font-weight:bold; font-family:monospace;">Bs. ${formatearMonto(tasaActual)}</td></tr>
                                <tr><td style="color:#64748b;">Ajuste Cambiario:</td><td style="font-weight:bold; font-family:monospace; color:#2563eb;">${kpiAjuste}</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <h3 style="font-size:12px; color:#475569; text-transform:uppercase; margin-bottom:6px;">1. Asignación y Consumo por Lote (Método FIFO)</h3>
                <table class="table-main">
                    <thead>
                        <tr>
                            <th style="text-align:left;">Lote Af.</th>
                            <th style="text-align:center;">Descargado</th>
                            <th style="text-align:right;">Costo ($)</th>
                            <th style="text-align:right;">Subtotal ($)</th>
                            <th style="text-align:right;">Tasa Org.</th>
                            <th style="text-align:right;">Subtotal Org. (Bs)</th>
                            <th style="text-align:right;">Subtotal Liq. (Bs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlFilasFifo}
                    </tbody>
                </table>

                <table style="width:50%; margin-left:auto; border-collapse:collapse; margin-top:15px; margin-bottom:25px; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px;">
                    <tr>
                        <td style="padding: 4px 8px; color: #64748b; font-size:12px;">Valor Equivalente USD:</td>
                        <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 600;">$${kpiUsd}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 8px; color: #64748b; font-size:12px;">Monto Prepago Origen:</td>
                        <td style="padding: 4px 8px; text-align: right; font-family: monospace;">Bs. ${kpiBsOrigen}</td>
                    </tr>
                    <tr style="border-top: 1px dashed #cbd5e1;">
                        <td style="padding: 6px 8px; color: #047857; font-weight: bold; font-size:13px;">Total Liquidado Actual:</td>
                        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #047857; font-size:14px;">Bs. ${kpiBsActual}</td>
                    </tr>
                </table>

                <table style="width:100%; margin-top:60px; border-collapse:collapse;">
                    <tr>
                        <td style="width:50%; text-align:center;">
                            <div class="firma-linea" style="margin: 0 auto;">Almacén / Recepción</div>
                        </td>
                        <td style="width:50%; text-align:center;">
                            <div class="firma-linea" style="margin: 0 auto;">Transportista / Entregado</div>
                        </td>
                    </tr>
                </table>

                <div style="margin-top:50px; border-top:1px solid #e2e8f0; padding-top:8px; text-align:center; font-size:10px; color:#94a3b8;">
                    SICOOP Web Corporativo v2.5 • Este comprobante verifica el consumo FIFO de prepagos activos.
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            <\/script>
        </body>
        </html>
    `); //[cite: 4]
    ventanaImpresion.document.close(); //[cite: 4]
}

function procesarEnvioRecepcion(e) {
    e.preventDefault(); //[cite: 4]
    const btn = document.getElementById("btn-guardar-recepcion") || e.target.querySelector('button[type="submit"]'); //[cite: 4]
    if (btn) {
        btn.disabled = true; //[cite: 4]
        btn.innerText = "⏳ Descargando de cola FIFO..."; //[cite: 4]
    }

    const numFacturaInput = document.getElementById("rec-guia") || document.getElementById("rec-factura") || document.querySelector('input[placeholder*="FACTURA"]'); //[cite: 4]

    const payload = {
        accion: "registrar_despacho",
        data: {
            proveedor: document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "",
            producto: document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "",
            cantidad: parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0,
            fecha: document.getElementById("rec-fecha") ? document.getElementById("rec-fecha").value : new Date().toISOString().split('T')[0],
            tasaRecepcion: parseFloat(document.getElementById("rec-tasa") ? document.getElementById("rec-tasa").value : 1) || 1,
            nroFactura: numFacturaInput ? numFacturaInput.value : "N/A"
        }
    }; //[cite: 4]

    window.respuestaRecepcionGoogle = function(res) {
        if (res && res.status === "success") { //[cite: 4]
            imprimirComprobanteRecepcion(); //[cite: 4]
            alert(`✅ Carga recibida exitosamente. El inventario FIFO fue actualizado en las tablas de la Cooperativa.`); //[cite: 4]
            const form = document.getElementById("form-recepcion"); //[cite: 4]
            if (form) form.reset(); //[cite: 4]
            resetearKPIsRecepcion(); //[cite: 4]
            cargarDatos(); //[cite: 4]
            cambiarModulo("mod-dashboard"); //[cite: 4]
        } else {
            alert("⚠️ " + (res && res.message ? res.message : "Error procesando la recepción en el servidor.")); //[cite: 4]
            if (btn) {
                btn.disabled = false; //[cite: 4]
                btn.innerText = "📦 Confirmar Recepción de Carga"; //[cite: 4]
            }
        }
        const loader = document.getElementById('jsonp-recepcion-loader'); //[cite: 4]
        if (loader) loader.remove(); //[cite: 4]
    };

    const scriptEnvio = document.createElement('script'); //[cite: 4]
    scriptEnvio.id = 'jsonp-recepcion-loader'; //[cite: 4]
    const datosSerializados = encodeURIComponent(JSON.stringify(payload)); //[cite: 4]
    scriptEnvio.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaRecepcionGoogle&payload=${datosSerializados}`; //[cite: 4]
    
    scriptEnvio.onerror = function() {
        alert("❌ Error de comunicación con el servidor al registrar el despacho."); //[cite: 4]
        if (btn) {
            btn.disabled = false; //[cite: 4]
            btn.innerText = "📦 Confirmar Recepción de Carga"; //[cite: 4]
        }
        const loader = document.getElementById('jsonp-recepcion-loader'); //[cite: 4]
        if (loader) loader.remove(); //[cite: 4]
    };

    document.body.appendChild(scriptEnvio); //[cite: 4]
}

// PROVEEDORES
function procesarEnvioProveedor(e) {
    e.preventDefault(); //[cite: 4]
    const btn = document.getElementById("btn-guardar-proveedor"); //[cite: 4]
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Guardando..."; } //[cite: 4]

    const nombre = document.getElementById("prov-nombre").value.trim(); //[cite: 4]
    const inputsMercancia = document.querySelectorAll(".input-mercancia"); //[cite: 4]
    const productos = []; //[cite: 4]

    inputsMercancia.forEach(inp => {
        const val = inp.value.trim(); //[cite: 4]
        if (val) productos.push(val); //[cite: 4]
    });

    if (!nombre || productos.length === 0) {
        alert("Por favor ingrese el nombre del proveedor y al menos un producto."); //[cite: 4]
        if (btn) { btn.disabled = false; btn.innerText = "💾 Guardar Proveedor"; } //[cite: 4]
        return;
    }

    const payload = {
        accion: "registrar_proveedor",
        data: { nombre, productos }
    }; //[cite: 4]

    window.respuestaProveedorGoogle = function(res) {
        if (res && res.status === "success") { //[cite: 4]
            alert(`🤝 Proveedor "${nombre}" registrado exitosamente.`); //[cite: 4]
            document.getElementById("form-proveedor").reset(); //[cite: 4]
            document.getElementById("contenedor-mercancias").innerHTML = `
                <div class="flex gap-2 text-xs">
                    <input type="text" class="input-mercancia w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white" placeholder="Producto" required>
                </div>
            `; //[cite: 4]
            cargarDatos(); //[cite: 4]
        } else {
            alert("⚠️ " + (res && res.message ? res.message : "Error al guardar el proveedor.")); //[cite: 4]
        }
        if (btn) { btn.disabled = false; btn.innerText = "💾 Guardar Proveedor"; } //[cite: 4]
        const loader = document.getElementById('jsonp-prov-loader'); //[cite: 4]
        if (loader) loader.remove(); //[cite: 4]
    };

    const scriptEnvio = document.createElement('script'); //[cite: 4]
    scriptEnvio.id = 'jsonp-prov-loader'; //[cite: 4]
    const datosSerializados = encodeURIComponent(JSON.stringify(payload)); //[cite: 4]
    scriptEnvio.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaProveedorGoogle&payload=${datosSerializados}`; //[cite: 4]
    
    scriptEnvio.onerror = function() {
        alert("❌ Error de enlace al guardar el proveedor."); //[cite: 4]
        if (btn) { btn.disabled = false; btn.innerText = "💾 Guardar Proveedor"; } //[cite: 4]
        const loader = document.getElementById('jsonp-prov-loader'); //[cite: 4]
        if (loader) loader.remove(); //[cite: 4]
    };

    document.body.appendChild(scriptEnvio); //[cite: 4]
}

// REPORTES Y AUDITORÍA
function renderizarTablaReportes() {
    const tbody = document.getElementById("tabla-reportes-body"); //[cite: 4]
    const filtroProv = document.getElementById("reporte-filtro-proveedor") ? document.getElementById("reporte-filtro-proveedor").value : ""; //[cite: 4]
    if (!tbody) return; //[cite: 4]

    tbody.innerHTML = ""; //[cite: 4]

    if (!cacheHistorialDespachos || cacheHistorialDespachos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-xs text-slate-500 italic">No existen registros de auditoría o despachos consumidos</td></tr>`; //[cite: 4]
        return;
    }

    const datosFiltrados = filtroProv 
        ? cacheHistorialDespachos.filter(h => h.proveedor === filtroProv) 
        : cacheHistorialDespachos; //[cite: 4]

    datosFiltrados.forEach(h => {
        tbody.insertAdjacentHTML("beforeend", `
            <tr class="hover:bg-slate-900/50 border-b border-slate-800 text-xs">
                <td class="px-4 py-3 font-mono text-slate-400">${h.fecha || '-'}</td>
                <td class="px-4 py-3 font-mono font-bold text-blue-400">${h.idLote}</td>
                <td class="px-4 py-3 font-medium text-white">${h.proveedor}</td>
                <td class="px-4 py-3 text-slate-300">${h.producto}</td>
                <td class="px-4 py-3 text-right font-mono text-emerald-400 font-bold">${formatearMonto(h.cantidadDespachada)}</td>
                <td class="px-4 py-3 text-right font-mono text-slate-300">$${formatearMonto(h.costoUsdUnit)}</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-blue-400">Bs. ${formatearMonto(h.totalBsRecepcion)}</td>
            </tr>
        `); //[cite: 4]
    });
}

// Event Listeners Globales
document.addEventListener("DOMContentLoaded", function() {
    cargarDatos(); //[cite: 4]

    // Escuchar el evento input en 'rec-monto-bs' para disparar el recálculo
    const recMontoBs = document.getElementById("rec-monto-bs");
    if (recMontoBs) {
        recMontoBs.addEventListener("input", actualizarTablaRecepcionCascada);
    }

    const formPrepago = document.getElementById("form-prepago"); //[cite: 4]
    if (formPrepago) formPrepago.addEventListener("submit", procesarEnvioPrepago); //[cite: 4]

    const formRecepcion = document.getElementById("form-recepcion"); //[cite: 4]
    if (formRecepcion) formRecepcion.addEventListener("submit", procesarEnvioRecepcion); //[cite: 4]

    const formProveedor = document.getElementById("form-proveedor"); //[cite: 4]
    if (formProveedor) formProveedor.addEventListener("submit", procesarEnvioProveedor); //[cite: 4]
});
