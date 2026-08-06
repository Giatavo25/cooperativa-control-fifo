const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUTz-A1b6Q2QUZsU_uJC023IWgscqp2Ga-U2WxoORnQuYlLDvebCfIFlYjZBTfb2Ddiw/exec";

let cacheProveedores = [];
let cacheHistorialDespachos = [];
let cacheUltimosDatos = null;
let chartsCargados = false;

// Formateador numérico regional (Miles: Punto | Decimales: Coma)
function formatearMonto(valor) {
    const numero = parseFloat(valor);
    if (isNaN(numero)) return "0,00";
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

function inicializarGraficos() {
    try {
        if (typeof google !== 'undefined' && google.charts) {
            google.charts.load('current', {'packages':['corechart', 'bar']});
            google.charts.setOnLoadCallback(function() { chartsCargados = true; });
        }
    } catch (e) { console.warn("Google Charts no disponible."); }
}

function cargarDatos() {
    const elProgreso = document.getElementById('chart-progreso');
    const elDistribucion = document.getElementById('chart-distribucion');
    
    if (elProgreso) elProgreso.innerHTML = "<span class='text-blue-400 animate-pulse'>Sincronizando con Sheets de la Cooperativa...</span>";
    if (elDistribucion) elDistribucion.innerHTML = "<span class='text-blue-400 animate-pulse'>Analizando Lotes...</span>";

    window.procesarRespuestaGoogle = function(resultado) {
        try {
            if (resultado && resultado.status === "success") {
                cacheUltimosDatos = resultado;
                cacheProveedores = resultado.data.proveedores || [];
                cacheHistorialDespachos = resultado.data.historialDespachos || [];
                
                renderizarDashboard(resultado.data);
                actualizarInterfacesProveedores();
                renderizarTablaReportes();
                configurarFechaPorDefecto();
            }
        } catch (err) { console.error("Error procesando datos:", err); }
        const l = document.getElementById('jsonp-script-loader'); if (l) l.remove();
    };

    if (!chartsCargados) inicializarGraficos();

    const script = document.createElement('script');
    script.id = 'jsonp-script-loader';
    script.src = WEB_APP_URL + (WEB_APP_URL.includes('?') ? '&' : '?') + 'callback=procesarRespuestaGoogle';
    script.onerror = function() {
        if (elProgreso) elProgreso.innerText = "⚠️ Error de conexión con Google.";
    };
    document.body.appendChild(script);
}

function cambiarModulo(idModulo) {
    const target = document.getElementById(idModulo); if (!target) return;
    document.querySelectorAll('.modulo').forEach(m => m.classList.add('hidden'));
    target.classList.remove('hidden');
    
    document.querySelectorAll('aside nav button').forEach(b => {
        b.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800 transition";
    });
    const btn = document.getElementById('nav-' + idModulo);
    if (btn) btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white transition";
    
    const titulos = { 
        'mod-dashboard': 'Dashboard General', 
        'mod-prepagos': 'Registrar Prepagos', 
        'mod-recepcion': 'Recepción de Carga', 
        'mod-proveedores': 'Ficha de Proveedores', 
        'mod-reportes': 'Reportes y Auditoría' 
    };
    const titleDom = document.getElementById('titulo-modulo'); if (titleDom) titleDom.innerText = titulos[idModulo] || 'Sistema';
    if (idModulo === 'mod-dashboard') cargarDatos();
}

function agregarCampoMercancia() {
    const div = document.createElement('div'); div.className = "flex gap-2 mt-1";
    div.innerHTML = `<input type="text" class="input-mercancia w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" placeholder="Producto" required><button type="button" onclick="this.parentElement.remove()" class="bg-red-900/80 text-red-200 px-3 rounded-lg font-bold hover:bg-red-800 text-xs">-</button>`;
    document.getElementById('contenedor-mercancias').appendChild(div);
}

function actualizarInterfacesProveedores() {
    document.querySelectorAll('.select-proveedores').forEach(sel => {
        const val = sel.value;
        sel.innerHTML = '<option value="">-- Seleccione un proveedor --</option>';
        cacheProveedores.forEach(p => sel.innerHTML += `<option value="${p.nombre}">${p.nombre}</option>`);
        if (val) sel.value = val;
    });

    const lista = document.getElementById('lista-proveedores-completa');
    if (lista) {
        lista.innerHTML = "";
        cacheProveedores.forEach(p => {
            const prods = Array.isArray(p.productos) ? p.productos : [];
            const chips = prods.map(pr => `<span class="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700">${pr}</span>`).join(' ');
            lista.innerHTML += `<div class="p-3 bg-slate-950 rounded-lg border border-slate-800"><p class="font-bold text-sm text-white">${p.nombre}</p><div class="flex flex-wrap gap-1 mt-2">${chips || '<span class="text-xs text-slate-600 italic">Sin mercancía</span>'}</div></div>`;
        });
    }
}

function filtrarProductosPorProveedor(prov, idDestino) {
    const dest = document.getElementById(idDestino); if (!dest) return;
    dest.innerHTML = "";
    if (!prov) { dest.innerHTML = '<option value="">-- Seleccione primero un proveedor --</option>'; return; }
    const item = cacheProveedores.find(p => p.nombre === prov);
    if (item && Array.isArray(item.productos) && item.productos.length > 0) {
        dest.innerHTML = '<option value="">-- Seleccione Mercancía --</option>';
        item.productos.forEach(pr => dest.innerHTML += `<option value="${pr}">${pr}</option>`);
    } else { dest.innerHTML = '<option value="">⚠️ Sin mercancía registrada</option>'; }
}

function renderizarDashboard(data) {
    let p = 0, pe = 0, r = 0;
    const tbody = document.getElementById("tabla-lotes"); if (!tbody) return;
    tbody.innerHTML = "";
    
    if (!data.detallesLotes || data.detallesLotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-xs text-slate-500 italic">No hay lotes activos registrados</td></tr>`;
        return;
    }

    data.detallesLotes.forEach(l => {
        const rec = l.cantOriginal - l.cantDisponible; p += l.cantOriginal; pe += l.cantDisponible; r += rec;
        tbody.insertAdjacentHTML("beforeend", `
            <tr class="hover:bg-slate-900/50 border-b border-slate-800">
                <td class="px-6 py-4 font-mono text-xs font-bold text-blue-400">${l.idLote}</td>
                <td class="px-6 py-4 font-medium">${l.proveedor}</td>
                <td class="px-6 py-4">${l.producto}</td>
                <td class="px-6 py-4 text-right font-mono">${formatearMonto(l.cantOriginal)}</td>
                <td class="px-6 py-4 text-right font-mono font-bold text-amber-400">${formatearMonto(l.cantDisponible)}</td>
            </tr>
        `);
    });

    if (document.getElementById("kpi-prepagado")) document.getElementById("kpi-prepagado").innerText = formatearMonto(p);
    if (document.getElementById("kpi-recibido")) document.getElementById("kpi-recibido").innerText = formatearMonto(r);
    if (document.getElementById("kpi-pendiente")) document.getElementById("kpi-pendiente").innerText = formatearMonto(pe);
    
    if (chartsCargados && data.resumenConsolidated) dibujarGraficos(data.resumenConsolidated);
}

function dibujarGraficos(resumen) {
    try {
        const pDom = document.getElementById('chart-progreso');
        const dDom = document.getElementById('chart-distribucion');
        if (!pDom || !dDom) return;

        const dtP = new google.visualization.DataTable();
        dtP.addColumn('string', 'Proveedor'); dtP.addColumn('number', 'Recibido'); dtP.addColumn('number', 'Pendiente');
        const dtT = [['Proveedor', 'Pendiente']];
        resumen.forEach(r => { dtP.addRow([r.proveedor, r.totalRecibido, r.totalPendiente]); dtT.push([r.proveedor, r.totalPendiente]); });
        
        const opt = { backgroundColor: 'transparent', legend: {textStyle:{color:'#94a3b8'}}, chartArea: {width: '80%', height: '80%'}, hAxis:{textStyle:{color:'#64748b'}}, vAxis:{textStyle:{color:'#64748b'}} };
        new google.visualization.BarChart(pDom).draw(dtP, { ...opt, isStacked: true, colors: ['#10b981', '#f59e0b'] });
        new google.visualization.PieChart(dDom).draw(google.visualization.arrayToDataTable(dtT), { ...opt, colors: ['#3b82f6', '#f59e0b', '#ef4444'], pieHole: 0.4 });
    } catch (e) {}
}

function configurarFechaPorDefecto() {
    const el = document.getElementById("pre-fecha");
    if (el && !el.value) {
        const hoy = new Date().toISOString().split('T')[0];
        el.value = hoy;
    }
    const elRec = document.getElementById("rec-fecha");
    if (elRec && !elRec.value) {
        const hoy = new Date().toISOString().split('T')[0];
        elRec.value = hoy;
    }
}

function actualizarFlujoProveedorPrepago(prov) {
    const container = document.getElementById("contenedor-items-prepago");
    container.innerHTML = "";
    
    if (!prov) {
        document.getElementById("pre-lote-sugerido").innerText = "AUTO-GEN";
        return;
    }

    let correlativo = 1;
    if (cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.detallesLotes) {
        const filtrados = cacheUltimosDatos.data.detallesLotes.filter(x => x.proveedor === prov);
        correlativo = filtrados.length + 1;
    }
    const iniciales = prov.substring(0, 3).toUpperCase();
    document.getElementById("pre-lote-sugerido").innerText = `${iniciales}-${String(correlativo).padStart(3, '0')}`;

    agregarFilaMercanciaPrepago();
}

function agregarFilaMercanciaPrepago() {
    const prov = document.getElementById("pre-proveedor").value;
    if (!prov) { alert("Por favor, seleccione primero un proveedor."); return; }

    const pData = cacheProveedores.find(x => x.nombre === prov);
    const productos = (pData && pData.productos) ? pData.productos : [];
    
    const tr = document.createElement('tr');
    tr.className = "item-fila-prepago bg-slate-950/40 hover:bg-slate-900/40 transition";
    
    let opcionesHtml = `<option value="">Seleccione...</option>`;
    productos.forEach(pr => opcionesHtml += `<option value="${pr}">${pr}</option>`);

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
    `;
    document.getElementById("contenedor-items-prepago").appendChild(tr);
    calcularTotalesPrepago();
}

function calcularTotalesPrepago() {
    const tasa = parseFloat(document.getElementById("pre-tasa").value) || 0;
    let sumatoriaUsd = 0;

    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const cant = parseFloat(fila.querySelector(".item-cantidad").value) || 0;
        const costoUsd = parseFloat(fila.querySelector(".item-costo-usd").value) || 0;
        
        const tUsd = cant * costoUsd;
        const tBs = tUsd * tasa;
        sumatoriaUsd += tUsd;

        fila.querySelector(".item-total-usd-txt").innerText = formatearMonto(tUsd);
        fila.querySelector(".item-total-bs-txt").innerText = formatearMonto(tBs);
    });

    const totalBsObligatorio = sumatoriaUsd * tasa;

    let sumatoriaBancos = 0;
    document.querySelectorAll(".input-banco-prepago").forEach(inp => {
        if (!inp.dataset.listenerAsignado) {
            inp.addEventListener("input", calcularTotalesPrepago);
            inp.dataset.listenerAsignado = "true";
        }
        sumatoriaBancos += parseFloat(inp.value) || 0;
    });

    const diferencia = totalBsObligatorio - sumatoriaBancos;

    document.getElementById("txt-total-usd").innerText = formatearMonto(sumatoriaUsd);
    document.getElementById("txt-total-bs").innerText = formatearMonto(totalBsObligatorio);
    document.getElementById("txt-total-bancos").innerText = formatearMonto(sumatoriaBancos);
    
    const txtDiffEl = document.getElementById("txt-diferencia");
    if (txtDiffEl) txtDiffEl.innerText = formatearMonto(Math.abs(diferencia));

    const wrapperDiff = document.getElementById("wrapper-diferencia");
    const btnGuardar = document.getElementById("btn-guardar-prepago");
    const btnImprimir = document.getElementById("btn-imprimir-prepago");

    if (totalBsObligatorio > 0 && Math.abs(diferencia) <= 1) {
        wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-400";
        wrapperDiff.innerText = "✅ Cuadrado / Conciliación Bancaria Exitosa";
        
        btnGuardar.disabled = false;
        btnGuardar.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center";
        
        btnImprimir.disabled = false;
        btnImprimir.className = "bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1 w-full";
    } else {
        wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-xs bg-red-950/60 border border-red-800 text-red-400";
        
        if (diferencia >= 0) {
            wrapperDiff.innerHTML = `Falta por conciliar: <span class="font-mono">${formatearMonto(diferencia)}</span> Bs`;
        } else {
            wrapperDiff.innerHTML = `Monto excedido en bancos: <span class="font-mono">${formatearMonto(Math.abs(diferencia))}</span> Bs`;
        }
        
        btnGuardar.disabled = true;
        btnGuardar.className = "bg-blue-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
        
        btnImprimir.disabled = true;
        btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full";
    }
}

function imprimirReciboPrepago() {
    const prov = document.getElementById("pre-proveedor").value;
    const lote = document.getElementById("pre-lote-sugerido").innerText;
    const tasa = parseFloat(document.getElementById("pre-tasa").value) || 1;
    const fecha = document.getElementById("pre-fecha").value;
    
    let htmlItems = "";
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const prod = fila.querySelector(".item-producto").value;
        const cant = parseFloat(fila.querySelector(".item-cantidad").value) || 0;
        const cost = parseFloat(fila.querySelector(".item-costo-usd").value) || 0;
        const totUsd = cant * cost;
        const totBs = totUsd * tasa;
        htmlItems += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; text-align: left; color: #334155;">${prod}</td>
                <td style="padding: 10px 8px; text-align: center; font-family: monospace;">${cant}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace;">$${formatearMonto(cost)}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #1e293b;">$${formatearMonto(totUsd)}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; color: #2563eb;">Bs. ${formatearMonto(totBs)}</td>
            </tr>`;
    });

    let htmlBancos = "";
    const bancosMapeados = [
        { id: "pago-banesco", label: "BANESCO" },
        { id: "pago-mercantil", label: "MERCANTIL" },
        { id: "pago-provincial", label: "PROVINCIAL" },
        { id: "pago-bancaribe", label: "BANCARIBE" },
        { id: "pago-activo", label: "BANCO ACTIVO" }
    ];

    bancosMapeados.forEach(b => {
        const val = parseFloat(document.getElementById(b.id).value) || 0;
        if (val > 0) {
            htmlBancos += `
                <tr>
                    <td style="padding: 6px 0; color: #475569; font-size: 13px;">• Débito cuenta ${b.label}:</td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; color: #0f766e; font-size: 13px;">Bs. ${formatearMonto(val)}</td>
                </tr>`;
        }
    });

    const tUsd = document.getElementById("txt-total-usd").innerText;
    const tBs = document.getElementById("txt-total-bs").innerText;

    const ventanaImpresion = window.open('', '_blank', 'width=850,height=1100');
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
    `);
    ventanaImpresion.document.close();
}

function procesarEnvioPrepago(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-guardar-prepago");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Guardando..."; }

    const items = [];
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        items.push({
            producto: fila.querySelector(".item-producto").value,
            cantidad: parseFloat(fila.querySelector(".item-cantidad").value) || 0,
            costoUsd: parseFloat(fila.querySelector(".item-costo-usd").value) || 0
        });
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
    };

    window.respuestaGuardadoGoogle = function(res) {
        if (res && res.status === "success") {
            imprimirReciboPrepago();
            alert(`🚀 Transmisión limpia: Lote ${payload.data.idLote} guardado con éxito.`);
            document.getElementById("form-prepago").reset();
            document.getElementById("contenedor-items-prepago").innerHTML = "";
            calcularTotalesPrepago();
            cambiarModulo("mod-dashboard");
        } else {
            alert("⚠️ " + (res && res.message ? res.message : "El servidor devolvió una alerta."));
            if (btn) { btn.disabled = false; btn.innerText = "💾 Procesar Guardado"; }
        }
        const loader = document.getElementById('jsonp-guardar-loader');
        if (loader) loader.remove();
    };

    const scriptEnvio = document.createElement('script');
    scriptEnvio.id = 'jsonp-guardar-loader';
    const datosSerializados = encodeURIComponent(JSON.stringify(payload));
    scriptEnvio.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaGuardadoGoogle&payload=${datosSerializados}`;
    
    scriptEnvio.onerror = function() {
        alert("❌ Error de red al comunicarse con Google Apps Script.");
        if (btn) { btn.disabled = false; btn.innerText = "💾 Procesar Guardado"; }
        const loader = document.getElementById('jsonp-guardar-loader');
        if (loader) loader.remove();
    };

    document.body.appendChild(scriptEnvio);
}

// RECEPCCIÓN DE CARGA Y MOTOR FIFO CASCADA
function actualizarFlujoProveedorRecepcion(prov) {
    filtrarProductosPorProveedor(prov, "rec-producto");
    actualizarTablaRecepcionCascada();
}

/**
 * Función que recalcula la tabla FIFO y vincula MONTO TOTAL FACTURA (Bs) con Valor Hoy (Bs), Ajuste / Valorización y Total Hoy (Bs)
 */
function actualizarTablaRecepcionCascada() {
    const inputMontoBs = document.getElementById("rec-monto-bs");
    const elKpiBsActual = document.getElementById("rec-kpi-bs-actual");
    const valorBsDirecto = parseFloat(inputMontoBs ? inputMontoBs.value : 0) || 0;

    // Actualizar el KPI Valor Hoy (Bs)
    if (elKpiBsActual) {
        if ('value' in elKpiBsActual) {
            elKpiBsActual.value = valorBsDirecto;
        } else {
            elKpiBsActual.innerText = formatearMonto(valorBsDirecto);
        }
    }

    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
    const cantRecepcion = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;

    const tbody = document.getElementById("rec-tabla-lotes-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!prov || !prod || !cacheUltimosDatos || !cacheUltimosDatos.data || !cacheUltimosDatos.data.detallesLotes) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-slate-500 italic">Seleccione proveedor y producto para cargar desglose FIFO</td></tr>`;
        resetearKPIsRecepcion();
        return;
    }

    const lotesDisponibles = cacheUltimosDatos.data.detallesLotes.filter(l => 
        l.proveedor === prov && 
        l.producto === prod && 
        l.cantDisponible > 0
    );

    if (lotesDisponibles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-amber-500 italic">⚠️ No hay lotes pendientes para este producto</td></tr>`;
        resetearKPIsRecepcion();
        return;
    }

    // Paso 1: Pre-cálculo para determinar la cantidad tomada y el total en USD tomado en cola FIFO
    let remanenteTemp = cantRecepcion;
    let sumUsdOriginal = 0;
    const itemsProcesados = [];

    lotesDisponibles.forEach(lote => {
        const cantDisponible = lote.cantDisponible;
        let cantTomada = 0;

        if (remanenteTemp > 0) {
            cantTomada = Math.min(remanenteTemp, cantDisponible);
            remanenteTemp -= cantTomada;
        }

        const costoUsdUnit = lote.costoUsd || 0;
        const totalUsdTomado = cantTomada * costoUsdUnit;
        sumUsdOriginal += totalUsdTomado;

        itemsProcesados.push({
            lote,
            cantDisponible,
            cantTomada,
            costoUsdUnit,
            totalUsdTomado
        });
    });

    // Paso 2: Renderizado de la tabla FIFO y cómputo de Costo Origen y Total Hoy (Bs)
    let remanentePorDespachar = cantRecepcion;
    let sumBsOriginal = 0;
    let sumBsActual = 0;

    itemsProcesados.forEach(item => {
        const lote = item.lote;
        const cantDisponible = item.cantDisponible;
        const cantTomada = item.cantTomada;
        const costoUsdUnit = item.costoUsdUnit;
        const totalUsdTomado = item.totalUsdTomado;
        const tasaOrigen = lote.tasaOriginal || 0;

        if (remanentePorDespachar > 0 && cantTomada > 0) {
            remanentePorDespachar -= cantTomada;
        }

        const totalBsOrigenTomado = totalUsdTomado * tasaOrigen;
        
        // Distribución del Valor Hoy (Bs) en la tabla FIFO proporcionalmente al USD de cada lote
        let totalBsActualTomado = 0;
        if (valorBsDirecto > 0 && sumUsdOriginal > 0 && cantTomada > 0) {
            totalBsActualTomado = (totalUsdTomado / sumUsdOriginal) * valorBsDirecto;
        }

        sumBsOriginal += totalBsOrigenTomado;
        sumBsActual += totalBsActualTomado;

        const row = document.createElement("tr");
        row.className = cantTomada > 0 ? "bg-blue-950/30 border-b border-slate-800" : "opacity-40 border-b border-slate-800";
        row.innerHTML = `
            <td class="px-3 py-2 font-mono text-xs font-bold text-blue-400">${lote.idLote}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">${formatearMonto(cantDisponible)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-emerald-400 font-bold">${formatearMonto(cantTomada)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">$${formatearMonto(costoUsdUnit)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right font-bold text-slate-200">$${formatearMonto(totalUsdTomado)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">Bs. ${formatearMonto(tasaOrigen)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-slate-300">Bs. ${formatearMonto(totalBsOrigenTomado)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-blue-400 font-bold">Bs. ${formatearMonto(totalBsActualTomado)}</td>
        `;
        tbody.appendChild(row);
    });

    // Paso 3: Cálculo del Ajuste / Valorización = Valor Hoy (Bs) - Costo Origen (Bs)
    const valorHoyFinal = valorBsDirecto > 0 ? valorBsDirecto : sumBsActual;
    const ajusteValorizacionBs = valorHoyFinal - sumBsOriginal;

    if (document.getElementById("rec-kpi-usd")) document.getElementById("rec-kpi-usd").innerText = formatearMonto(sumUsdOriginal);
    if (document.getElementById("rec-kpi-bs-origen")) document.getElementById("rec-kpi-bs-origen").innerText = formatearMonto(sumBsOriginal);
    
    const kpiAjusteEl = document.getElementById("rec-kpi-ajuste");
    if (kpiAjusteEl) {
        kpiAjusteEl.innerText = `${ajusteValorizacionBs >= 0 ? '+' : ''}${formatearMonto(ajusteValorizacionBs)} Bs`;
        kpiAjusteEl.className = `font-mono text-lg font-bold ${ajusteValorizacionBs >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }

    const btnProcesar = document.getElementById("btn-guardar-recepcion");
    const btnImprimir = document.getElementById("btn-imprimir-recepcion");

    if (remanentePorDespachar > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.className = "bg-amber-600/50 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
            btnProcesar.innerText = `⚠️ Stock insuficiente (Faltan: ${formatearMonto(remanentePorDespachar)} und)`;
        }
        if (btnImprimir) {
            btnImprimir.disabled = true;
            btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full";
        }
    } else if (cantRecepcion > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = false;
            btnProcesar.className = "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center";
            btnProcesar.innerText = "📦 Confirmar Recepción de Carga";
        }
        if (btnImprimir) {
            btnImprimir.disabled = false;
            btnImprimir.className = "bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1 w-full";
        }
    } else {
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.className = "bg-emerald-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
            btnProcesar.innerText = "📦 Confirmar Recepción de Carga";
        }
        if (btnImprimir) {
            btnImprimir.disabled = true;
            btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full";
        }
    }
}

function resetearKPIsRecepcion() {
    if (document.getElementById("rec-kpi-usd")) document.getElementById("rec-kpi-usd").innerText = "0,00";
    if (document.getElementById("rec-kpi-bs-origen")) document.getElementById("rec-kpi-bs-origen").innerText = "0,00";
    if (document.getElementById("rec-kpi-bs-actual")) {
        const el = document.getElementById("rec-kpi-bs-actual");
        if ('value' in el) el.value = "0";
        else el.innerText = "0,00";
    }
    if (document.getElementById("rec-kpi-ajuste")) {
        document.getElementById("rec-kpi-ajuste").innerText = "0,00 Bs";
        document.getElementById("rec-kpi-ajuste").className = "font-mono text-lg font-bold text-slate-400";
    }
    const btn = document.getElementById("btn-guardar-recepcion");
    if (btn) {
        btn.disabled = true;
        btn.className = "bg-emerald-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
        btn.innerText = "📦 Confirmar Recepción de Carga";
    }
    const btnImp = document.getElementById("btn-imprimir-recepcion");
    if (btnImp) {
        btnImp.disabled = true;
        btnImp.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full";
    }
}

// IMPRESIÓN COMPROBANTE RECEPCIÓN DE CARGA
function imprimirComprobanteRecepcion() {
    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
    const cant = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;
    const fecha = document.getElementById("rec-fecha") ? document.getElementById("rec-fecha").value : new Date().toISOString().split('T')[0];
    const montoBsInput = parseFloat(document.getElementById("rec-monto-bs") ? document.getElementById("rec-monto-bs").value : 0) || 0;
    
    const numFacturaInput = document.getElementById("rec-guia") || document.getElementById("rec-factura") || document.querySelector('input[placeholder*="FACTURA"]');
    const factura = numFacturaInput ? numFacturaInput.value : "N/A";

    const kpiUsd = document.getElementById("rec-kpi-usd") ? document.getElementById("rec-kpi-usd").innerText : "0,00";
    const kpiBsOrigen = document.getElementById("rec-kpi-bs-origen") ? document.getElementById("rec-kpi-bs-origen").innerText : "0,00";
    
    const elBsActual = document.getElementById("rec-kpi-bs-actual");
    const kpiBsActual = elBsActual ? ('value' in elBsActual ? (parseFloat(elBsActual.value) ? formatearMonto(elBsActual.value) : "0,00") : elBsActual.innerText) : "0,00";
    
    const kpiAjuste = document.getElementById("rec-kpi-ajuste") ? document.getElementById("rec-kpi-ajuste").innerText : "0,00 Bs";

    const kpiUsdNum = parseFloat(kpiUsd.replace(/\./g, '').replace(',', '.')) || 0;
    const tasaActual = (montoBsInput > 0 && kpiUsdNum > 0) ? (montoBsInput / kpiUsdNum) : (parseFloat(document.getElementById("rec-tasa") ? document.getElementById("rec-tasa").value : 1) || 1);

    let htmlFilasFifo = "";
    const tbody = document.getElementById("rec-tabla-lotes-body");
    if (tbody) {
        const trs = tbody.querySelectorAll("tr");
        trs.forEach(tr => {
            const cols = tr.querySelectorAll("td");
            if (cols.length >= 8) {
                const idLote = cols[0].innerText;
                const cantTomada = cols[2].innerText;
                const costoUsd = cols[3].innerText;
                const totalUsd = cols[4].innerText;
                const tasaOrigen = cols[5].innerText;
                const totalBsOrigen = cols[6].innerText;
                const totalBsActual = cols[7].innerText;

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
                `;
            }
        });
    }

    const ventanaImpresion = window.open('', '_blank', 'width=850,height=1100');
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
    `);
    ventanaImpresion.document.close();
}

function procesarEnvioRecepcion(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-guardar-recepcion") || e.target.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Descargando de cola FIFO...";
    }

    const numFacturaInput = document.getElementById("rec-guia") || document.getElementById("rec-factura") || document.querySelector('input[placeholder*="FACTURA"]');
    const inputMontoBs = document.getElementById("rec-monto-bs");
    const valorBsDirecto = parseFloat(inputMontoBs ? inputMontoBs.value : 0) || 0;

    let tasaCalculada = 1;
    if (valorBsDirecto > 0 && cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.detallesLotes) {
        const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
        const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
        const cant = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;
        const lotes = cacheUltimosDatos.data.detallesLotes.filter(l => l.proveedor === prov && l.producto === prod && l.cantDisponible > 0);
        let rem = cant;
        let usdTotal = 0;
        lotes.forEach(l => {
            if (rem > 0) {
                const tom = Math.min(rem, l.cantDisponible);
                rem -= tom;
                usdTotal += tom * (l.costoUsd || 0);
            }
        });
        if (usdTotal > 0) {
            tasaCalculada = valorBsDirecto / usdTotal;
        }
    }

    const payload = {
        accion: "registrar_despacho",
        data: {
            proveedor: document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "",
            producto: document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "",
            cantidad: parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0,
            fecha: document.getElementById("rec-fecha") ? document.getElementById("rec-fecha").value : new Date().toISOString().split('T')[0],
            tasaRecepcion: tasaCalculada,
            montoTotalBs: valorBsDirecto,
            nroFactura: numFacturaInput ? numFacturaInput.value : "N/A"
        }
    };

    window.respuestaRecepcionGoogle = function(res) {
        if (res && res.status === "success") {
            imprimirComprobanteRecepcion();
            alert(`✅ Carga recibida exitosamente. El inventario FIFO fue actualizado en las tablas de la Cooperativa.`);
            const form = document.getElementById("form-recepcion");
            if (form) form.reset();
            resetearKPIsRecepcion();
            cargarDatos();
            cambiarModulo("mod-dashboard");
        } else {
            alert("⚠️ " + (res && res.message ? res.message : "Error procesando la recepción en el servidor."));
            if (btn) {
                btn.disabled = false;
                btn.innerText = "📦 Confirmar Recepción de Carga";
            }
        }
        const loader = document.getElementById('jsonp-recepcion-loader');
        if (loader) loader.remove();
    };

    const scriptEnvio = document.createElement('script');
    scriptEnvio.id = 'jsonp-recepcion-loader';
    const datosSerializados = encodeURIComponent(JSON.stringify(payload));
    scriptEnvio.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaRecepcionGoogle&payload=${datosSerializados}`;
    
    scriptEnvio.onerror = function() {
        alert("❌ Error de comunicación con el servidor al registrar el despacho.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📦 Confirmar Recepción de Carga";
        }
        const loader = document.getElementById('jsonp-recepcion-loader');
        if (loader) loader.remove();
    };

    document.body.appendChild(scriptEnvio);
}

// PROVEEDORES
function procesarEnvioProveedor(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-guardar-proveedor");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Guardando..."; }

    const nombre = document.getElementById("prov-nombre").value.trim();
    const inputsMercancia = document.querySelectorAll(".input-mercancia");
    const productos = [];

    inputsMercancia.forEach(inp => {
        const val = inp.value.trim();
        if (val) productos.push(val);
    });

    if (!nombre || productos.length === 0) {
        alert("Por favor ingrese el nombre del proveedor y al menos un producto.");
        if (btn) { btn.disabled = false; btn.innerText = "💾 Guardar Proveedor"; }
        return;
    }

    const payload = {
        accion: "registrar_proveedor",
        data: { nombre, productos }
    };

    window.respuestaProveedorGoogle = function(res) {
        if (res && res.status === "success") {
            alert(`🤝 Proveedor "${nombre}" registrado exitosamente.`);
            document.getElementById("form-proveedor").reset();
            document.getElementById("contenedor-mercancias").innerHTML = `
                <div class="flex gap-2 text-xs">
                    <input type="text" class="input-mercancia w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white" placeholder="Producto" required>
                </div>
            `;
            cargarDatos();
        } else {
            alert("⚠️ " + (res && res.message ? res.message : "Error al guardar el proveedor."));
        }
        if (btn) { btn.disabled = false; btn.innerText = "💾 Guardar Proveedor"; }
        const loader = document.getElementById('jsonp-prov-loader');
        if (loader) loader.remove();
    };

    const scriptEnvio = document.createElement('script');
    scriptEnvio.id = 'jsonp-prov-loader';
    const datosSerializados = encodeURIComponent(JSON.stringify(payload));
    scriptEnvio.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaProveedorGoogle&payload=${datosSerializados}`;
    
    scriptEnvio.onerror = function() {
        alert("❌ Error de enlace al guardar el proveedor.");
        if (btn) { btn.disabled = false; btn.innerText = "💾 Guardar Proveedor"; }
        const loader = document.getElementById('jsonp-prov-loader');
        if (loader) loader.remove();
    };

    document.body.appendChild(scriptEnvio);
}

// REPORTES Y AUDITORÍA
function renderizarTablaReportes() {
    const tbody = document.getElementById("tabla-reportes-body");
    const filtroProv = document.getElementById("reporte-filtro-proveedor") ? document.getElementById("reporte-filtro-proveedor").value : "";
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!cacheHistorialDespachos || cacheHistorialDespachos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-xs text-slate-500 italic">No existen registros de auditoría o despachos consumidos</td></tr>`;
        return;
    }

    const datosFiltrados = filtroProv 
        ? cacheHistorialDespachos.filter(h => h.proveedor === filtroProv) 
        : cacheHistorialDespachos;

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
        `);
    });
}

// Event Listeners Globales
document.addEventListener("DOMContentLoaded", function() {
    cargarDatos();

    const recMontoBs = document.getElementById("rec-monto-bs");
    if (recMontoBs) {
        recMontoBs.addEventListener("input", actualizarTablaRecepcionCascada);
    }

    const recCantidad = document.getElementById("rec-cantidad");
    if (recCantidad) {
        recCantidad.addEventListener("input", actualizarTablaRecepcionCascada);
    }

    const formPrepago = document.getElementById("form-prepago");
    if (formPrepago) formPrepago.addEventListener("submit", procesarEnvioPrepago);

    const formRecepcion = document.getElementById("form-recepcion");
    if (formRecepcion) formRecepcion.addEventListener("submit", procesarEnvioRecepcion);

    const formProveedor = document.getElementById("form-proveedor");
    if (formProveedor) formProveedor.addEventListener("submit", procesarEnvioProveedor);
});
