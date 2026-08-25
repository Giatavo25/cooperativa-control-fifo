const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUTz-A1b6Q2QUZsU_uJC023IWgscqp2Ga-U2WxoORnQuYlLDvebCfIFlYjZBTfb2Ddiw/exec";

let cacheProveedores = [];
let cacheHistorialDespachos = [];
let cacheUltimosDatos = null;
let chartsCargados = false;

// Variables globales para el sistema de seguridad dinámica y OTP
let codigoOtpActual = null;
let otpTimestamp = null;
let accionPendienteSeguridad = null;

// Formateador numérico regional (Miles: Punto | Decimales: Coma)
function formatearMonto(valor) {
    const numero = parseFloat(valor);
    if (isNaN(numero)) return "0,00";
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

// Formateador de Fecha a DD/MM/AAAA
function formatearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-') return '-';
    try {
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return fechaStr;
        
        const dia = String(fecha.getUTCDate()).padStart(2, '0');
        const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
        const anio = fecha.getUTCFullYear();
        
        return `${dia}/${mes}/${anio}`;
    } catch (e) {
        return fechaStr;
    }
}

function inicializarGraficos() {
    try {
        if (typeof google !== 'undefined' && google.charts) {
            google.charts.load('current', {'packages':['corechart', 'bar']});
            google.charts.setOnLoadCallback(function() { 
                chartsCargados = true; 
                if (cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.resumenConsolidated) {
                    dibujarGraficos(cacheUltimosDatos.data.resumenConsolidated);
                }
            });
        }
    } catch (e) { console.warn("Google Charts no disponible.", e); }
}

function cargarDatos() {
    const elProgreso = document.getElementById('chart-progreso');
    const elDistribucion = document.getElementById('chart-distribucion');
    
    if (elProgreso) elProgreso.innerHTML = "<span class='text-blue-400 animate-pulse'>Sincronizando con Sheets de la Cooperativa...</span>";
    if (elDistribucion) elDistribucion.innerHTML = "<span class='text-blue-400 animate-pulse'>Analizando Lotes...</span>";

    window.procesarRespuestaGoogle = function(resultado) {
        try {
            if (resultado && resultado.status === "success" && resultado.data) {
                cacheUltimosDatos = resultado;
                cacheProveedores = resultado.data.proveedores || [];
                cacheHistorialDespachos = resultado.data.historialDespachos || [];
                
                renderizarDashboard(resultado.data);
                actualizarInterfacesProveedores();
                renderizarTablaReportes();
                renderizarLibroMayor(); 
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
        const l = document.getElementById('jsonp-script-loader'); if (l) l.remove();
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
    
    if (idModulo === 'mod-dashboard') {
        cargarDatos();
        if (chartsCargados && cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.resumenConsolidated) {
            setTimeout(() => {
                dibujarGraficos(cacheUltimosDatos.data.resumenConsolidated);
            }, 100);
        }
    } else if (idModulo === 'mod-reportes') {
        renderizarTablaReportes();
        renderizarLibroMayor();
    }
}

function agregarCampoMercancia() {
    const contenedor = document.getElementById('contenedor-mercancias');
    if (!contenedor) return;
    const div = document.createElement('div'); div.className = "flex gap-2 mt-1";
    div.innerHTML = `<input type="text" class="input-mercancia w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" placeholder="Producto" required><button type="button" onclick="this.parentElement.remove()" class="bg-red-900/80 text-red-200 px-3 rounded-lg font-bold hover:bg-red-800 text-xs">-</button>`;
    contenedor.appendChild(div);
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
    let lotesMostrados = 0;
    const tbody = document.getElementById("tabla-lotes"); if (!tbody) return;
    tbody.innerHTML = "";
    
    if (!data || !data.detallesLotes || data.detallesLotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-xs text-slate-500 italic">No hay lotes registrados</td></tr>`;
        return;
    }

    data.detallesLotes.forEach(l => {
        const cantOrig = parseFloat(l.cantOriginal) || 0;
        const cantDisp = parseFloat(l.cantDisponible) || 0;
        const rec = cantOrig - cantDisp; 
        p += cantOrig; 
        pe += cantDisp; 
        r += rec;

        if (cantDisp > 0) {
            lotesMostrados++;
            tbody.insertAdjacentHTML("beforeend", `
                <tr class="hover:bg-slate-900/50 border-b border-slate-800">
                    <td class="px-6 py-4 font-mono text-xs font-bold text-blue-400">${l.idLote}</td>
                    <td class="px-6 py-4 font-medium">${l.proveedor}</td>
                    <td class="px-6 py-4">${l.producto}</td>
                    <td class="px-6 py-4 text-right font-mono">${formatearMonto(cantOrig)}</td>
                    <td class="px-6 py-4 text-right font-mono font-bold text-amber-400">${formatearMonto(cantDisp)}</td>
                </tr>
            `);
        }
    });

    if (lotesMostrados === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-xs text-slate-400 italic">✅ No hay lotes pendientes. Toda la mercancía ha sido recibida en almacén.</td></tr>`;
    }

    if (document.getElementById("kpi-prepagado")) document.getElementById("kpi-prepagado").innerText = formatearMonto(p);
    if (document.getElementById("kpi-recibido")) document.getElementById("kpi-recibido").innerText = formatearMonto(r);
    if (document.getElementById("kpi-pendiente")) document.getElementById("kpi-pendiente").innerText = formatearMonto(pe);
    
    if (chartsCargados && data.resumenConsolidated) dibujarGraficos(data.resumenConsolidated);
}

function dibujarGraficos(resumen) {
    try {
        const pDom = document.getElementById('chart-progreso');
        const dDom = document.getElementById('chart-distribucion');
        if (!pDom || !dDom || !Array.isArray(resumen)) return;

        pDom.innerHTML = "";
        dDom.innerHTML = "";

        const dtP = new google.visualization.DataTable();
        dtP.addColumn('string', 'Proveedor'); dtP.addColumn('number', 'Recibido'); dtP.addColumn('number', 'Pendiente');
        const dtT = [['Proveedor', 'Pendiente']];
        resumen.forEach(r => { dtP.addRow([r.proveedor, r.totalRecibido, r.totalPendiente]); dtT.push([r.proveedor, r.totalPendiente]); });
        
        const opt = { backgroundColor: 'transparent', legend: {textStyle:{color:'#94a3b8'}}, chartArea: {width: '80%', height: '80%'}, hAxis:{textStyle:{color:'#64748b'}}, vAxis:{textStyle:{color:'#64748b'}} };
        
        new google.visualization.BarChart(pDom).draw(dtP, { ...opt, isStacked: true, colors: ['#10b981', '#f59e0b'] });
        new google.visualization.PieChart(dDom).draw(google.visualization.arrayToDataTable(dtT), { ...opt, colors: ['#3b82f6', '#f59e0b', '#ef4444'], pieHole: 0.4 });
    } catch (e) { console.error("Error dibujando gráficas:", e); }
}

function configurarFechaPorDefecto() {
    const hoy = new Date().toISOString().split('T')[0];
    const el = document.getElementById("pre-fecha");
    if (el && !el.value) el.value = hoy;
    
    const elRec = document.getElementById("rec-fecha");
    if (elRec && !elRec.value) elRec.value = hoy;
}

function actualizarFlujoProveedorPrepago(prov) {
    const container = document.getElementById("contenedor-items-prepago");
    if (container) container.innerHTML = "";
    
    const elSugerido = document.getElementById("pre-lote-sugerido");
    if (!prov) {
        if (elSugerido) elSugerido.innerText = "AUTO-GEN";
        return;
    }

    const iniciales = prov.substring(0, 3).toUpperCase();
    let maxCorrelativo = 0;

    const todosLosRegistros = [];
    if (cacheUltimosDatos && cacheUltimosDatos.data && Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        todosLosRegistros.push(...cacheUltimosDatos.data.detallesLotes);
    }
    if (Array.isArray(cacheHistorialDespachos)) {
        todosLosRegistros.push(...cacheHistorialDespachos);
    }

    todosLosRegistros.forEach(item => {
        if (item.proveedor === prov && item.idLote) {
            const partes = String(item.idLote).split('-');
            if (partes.length > 1) {
                const num = parseInt(partes[partes.length - 1], 10);
                if (!isNaN(num) && num > maxCorrelativo) {
                    maxCorrelativo = num;
                }
            }
        }
    });

    const nuevoCorrelativo = maxCorrelativo + 1;
    if (elSugerido) elSugerido.innerText = `${iniciales}-${String(nuevoCorrelativo).padStart(3, '0')}`;

    if (typeof agregarFilaMercanciaPrepago === 'function') {
        agregarFilaMercanciaPrepago();
    }
}

function agregarFilaMercanciaPrepago() {
    const elProv = document.getElementById("pre-proveedor");
    const prov = elProv ? elProv.value : "";
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
            <input type="number" step="0.000001" class="item-costo-usd w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-xs text-white" placeholder="0.00" oninput="calcularTotalesPrepago()" required>
        </td>
        <td class="p-2 text-right font-mono text-xs text-slate-400 font-bold item-total-usd-txt">0,00</td>
        <td class="p-2 text-right font-mono text-xs text-blue-400 font-bold item-total-bs-txt">0,00</td>
        <td class="p-2 text-center">
            <button type="button" onclick="this.parentElement.parentElement.remove(); calcularTotalesPrepago();" class="text-red-500 hover:text-red-400 font-bold text-sm">✕</button>
        </td>
    `;
    
    const cont = document.getElementById("contenedor-items-prepago");
    if (cont) cont.appendChild(tr);
    calcularTotalesPrepago();
}

function calcularTotalesPrepago() {
    const elTasa = document.getElementById("pre-tasa");
    const tasa = parseFloat(elTasa ? elTasa.value : 0) || 0;
    let sumatoriaUsd = 0;

    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const cantInp = fila.querySelector(".item-cantidad");
        const costoInp = fila.querySelector(".item-costo-usd");
        const cant = parseFloat(cantInp ? cantInp.value : 0) || 0;
        const costoUsd = parseFloat(costoInp ? costoInp.value : 0) || 0;
        
        const tUsd = cant * costoUsd;
        const tBs = tUsd * tasa;
        sumatoriaUsd += tUsd;

        const txtUsd = fila.querySelector(".item-total-usd-txt");
        const txtBs = fila.querySelector(".item-total-bs-txt");
        if (txtUsd) txtUsd.innerText = formatearMonto(tUsd);
        if (txtBs) txtBs.innerText = formatearMonto(tBs);
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

    if (document.getElementById("txt-total-usd")) document.getElementById("txt-total-usd").innerText = formatearMonto(sumatoriaUsd);
    if (document.getElementById("txt-total-bs")) document.getElementById("txt-total-bs").innerText = formatearMonto(totalBsObligatorio);
    if (document.getElementById("txt-total-bancos")) document.getElementById("txt-total-bancos").innerText = formatearMonto(sumatoriaBancos);
    
    const txtDiffEl = document.getElementById("txt-diferencia");
    if (txtDiffEl) txtDiffEl.innerText = formatearMonto(Math.abs(diferencia));

    const wrapperDiff = document.getElementById("wrapper-diferencia");
    const btnGuardar = document.getElementById("btn-guardar-prepago");
    const btnImprimir = document.getElementById("btn-imprimir-prepago");

    if (wrapperDiff) {
        if (totalBsObligatorio > 0 && Math.abs(diferencia) <= 1) {
            wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-400";
            wrapperDiff.innerText = "✅ Cuadrado / Conciliación Bancaria Exitosa";
            
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center";
            }
            
            if (btnImprimir) {
                btnImprimir.disabled = false;
                btnImprimir.className = "bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1 w-full";
            }
        } else {
            wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-xs bg-red-950/60 border border-red-800 text-red-400";
            
            if (diferencia >= 0) {
                wrapperDiff.innerHTML = `Falta por conciliar: <span class="font-mono">${formatearMonto(diferencia)}</span> Bs`;
            } else {
                wrapperDiff.innerHTML = `Monto excedido en bancos: <span class="font-mono">${formatearMonto(Math.abs(diferencia))}</span> Bs`;
            }
            
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.className = "bg-blue-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
            }
            
            if (btnImprimir) {
                btnImprimir.disabled = true;
                btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full";
            }
        }
    }
}

function imprimirReciboPrepago() {
    const elProv = document.getElementById("pre-proveedor");
    const elLote = document.getElementById("pre-lote-sugerido");
    const elTasa = document.getElementById("pre-tasa");
    const elFecha = document.getElementById("pre-fecha");

    const prov = elProv ? elProv.value : "";
    const lote = elLote ? elLote.innerText : "";
    const tasa = parseFloat(elTasa ? elTasa.value : 1) || 1;
    const fecha = elFecha ? formatearFecha(elFecha.value) : "";
    
    let htmlItems = "";
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const prod = fila.querySelector(".item-producto") ? fila.querySelector(".item-producto").value : "";
        const cant = parseFloat(fila.querySelector(".item-cantidad") ? fila.querySelector(".item-cantidad").value : 0) || 0;
        const cost = parseFloat(fila.querySelector(".item-costo-usd") ? fila.querySelector(".item-costo-usd").value : 0) || 0;
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
        const el = document.getElementById(b.id);
        const val = el ? (parseFloat(el.value) || 0) : 0;
        if (val > 0) {
            htmlBancos += `
                <tr>
                    <td style="padding: 6px 0; color: #475569; font-size: 13px;">• Débito cuenta ${b.label}:</td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; color: #0f766e; font-size: 13px;">Bs. ${formatearMonto(val)}</td>
                </tr>`;
        }
    });

    const elUsd = document.getElementById("txt-total-usd");
    const elBs = document.getElementById("txt-total-bs");
    const tUsd = elUsd ? elUsd.innerText : "0,00";
    const tBs = elBs ? elBs.innerText : "0,00";

    const ventanaImpresion = window.open('', '_blank', 'width=850,height=1100');
    if (!ventanaImpresion) return;

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

                <h3 style="font-size:13px; color:#475569; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.5px;">1. Desglose de Prepago Realizado</h3>
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
            </script>
        </body>
        </html>
    `);
    ventanaImpresion.document.close();
}

function procesarEnvioPrepago(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById("btn-guardar-prepago");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Guardando..."; }

    const items = [];
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const prodInp = fila.querySelector(".item-producto");
        const cantInp = fila.querySelector(".item-cantidad");
        const costInp = fila.querySelector(".item-costo-usd");
        items.push({
            producto: prodInp ? prodInp.value : "",
            cantidad: parseFloat(cantInp ? cantInp.value : 0) || 0,
            costoUsd: parseFloat(costInp ? costInp.value : 0) || 0
        });
    });

    const getMontoBanco = (id) => {
        const el = document.getElementById(id);
        return el ? (parseFloat(el.value) || 0) : 0;
    };

    const elLote = document.getElementById("pre-lote-sugerido");
    const elProv = document.getElementById("pre-proveedor");
    const elFecha = document.getElementById("pre-fecha");
    const elTasa = document.getElementById("pre-tasa");

    const payload = {
        accion: "registrar_prepago_consolidado",
        data: {
            idLote: elLote ? elLote.innerText : "",
            proveedor: elProv ? elProv.value : "",
            fecha: elFecha ? elFecha.value : "",
            tasa: parseFloat(elTasa ? elTasa.value : 1) || 1,
            items: items,
            bancos: {
                BANESCO: getMontoBanco("pago-banesco"),
                MERCANTIL: getMontoBanco("pago-mercantil"),
                PROVINCIAL: getMontoBanco("pago-provincial"),
                BANCARIBE: getMontoBanco("pago-bancaribe"),
                BANCO_ACTIVO: getMontoBanco("pago-activo")
            }
        }
    };

    window.respuestaGuardadoGoogle = function(res) {
        if (res && res.status === "success") {
            imprimirReciboPrepago();
            alert(`🚀 Transmisión limpia: Lote ${payload.data.idLote} guardado con éxito.`);
            const formPrepago = document.getElementById("form-prepago");
            if (formPrepago) formPrepago.reset();
            const cont = document.getElementById("contenedor-items-prepago");
            if (cont) cont.innerHTML = "";
            calcularTotalesPrepago();
            cargarDatos();
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

// RECEPCIÓN DE CARGA Y MOTOR FIFO CASCADA
function actualizarFlujoProveedorRecepcion(prov) {
    filtrarProductosPorProveedor(prov, "rec-producto");
    actualizarTablaRecepcionCascada();
}

function actualizarTablaRecepcionCascada() {
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

    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
    const cantRecepcion = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;

    const tbody = document.getElementById("rec-tabla-lotes-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!prov || !prod || !cacheUltimosDatos || !cacheUltimosDatos.data || !Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-slate-500 italic">Seleccione proveedor y producto para cargar desglose FIFO</td></tr>`;
        resetearKPIsRecepcion();
        return;
    }

    const lotesDisponibles = cacheUltimosDatos.data.detallesLotes.filter(l => 
        l.proveedor === prov && 
        l.producto === prod && 
        (parseFloat(l.cantDisponible) || 0) > 0
    );

    if (lotesDisponibles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-amber-500 italic">⚠️ No hay lotes pendientes para este producto</td></tr>`;
        resetearKPIsRecepcion();
        return;
    }

    let remanenteTemp = cantRecepcion;
    let sumUsdOriginal = 0;
    const itemsProcesados = [];

    lotesDisponibles.forEach(lote => {
        const cantDisponible = parseFloat(lote.cantDisponible) || 0;
        let cantTomada = 0;

        if (remanenteTemp > 0) {
            cantTomada = Math.min(remanenteTemp, cantDisponible);
            remanenteTemp -= cantTomada;
        }

        const costoUsdUnit = parseFloat(lote.costoUsd) || 0;
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

    let remanentePorDespachar = cantRecepcion;
    let sumBsOriginal = 0;
    let sumBsActual = 0;

    itemsProcesados.forEach(item => {
        const lote = item.lote;
        const cantDisponible = item.cantDisponible;
        const cantTomada = item.cantTomada;
        const costoUsdUnit = item.costoUsdUnit;
        const totalUsdTomado = item.totalUsdTomado;
        const tasaOrigen = parseFloat(lote.tasaOriginal) || 0;

        if (remanentePorDespachar > 0 && cantTomada > 0) {
            remanentePorDespachar -= cantTomada;
        }

        const totalBsOrigenTomado = totalUsdTomado * tasaOrigen;
        
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

function imprimirComprobanteRecepcion() {
    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
    const cant = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;
    const fecha = document.getElementById("rec-fecha") ? formatearFecha(document.getElementById("rec-fecha").value) : formatearFecha(new Date().toISOString());
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
    if (!ventanaImpresion) return;

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
                            <th style="text-align:right;">Total Factura. (Bs)</th>
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
            </script>
        </body>
        </html>
    `);
    ventanaImpresion.document.close();
}

function procesarEnvioRecepcion(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById("btn-guardar-recepcion") || (e && e.target ? e.target.querySelector('button[type="submit"]') : null);
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Descargando de cola FIFO...";
    }

    const numFacturaInput = document.getElementById("rec-guia") || document.getElementById("rec-factura") || document.querySelector('input[placeholder*="FACTURA"]');
    const inputMontoBs = document.getElementById("rec-monto-bs");
    const valorBsDirecto = parseFloat(inputMontoBs ? inputMontoBs.value : 0) || 0;

    let tasaCalculada = 1;
    if (valorBsDirecto > 0 && cacheUltimosDatos && cacheUltimosDatos.data && Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
        const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
        const cant = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;
        const lotes = cacheUltimosDatos.data.detallesLotes.filter(l => l.proveedor === prov && l.producto === prod && (parseFloat(l.cantDisponible) || 0) > 0);
        let rem = cant;
        let usdTotal = 0;
        lotes.forEach(l => {
            if (rem > 0) {
                const tom = Math.min(rem, parseFloat(l.cantDisponible) || 0);
                rem -= tom;
                usdTotal += tom * (parseFloat(l.costoUsd) || 0);
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
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById("btn-guardar-proveedor");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Guardando..."; }

    const elNombre = document.getElementById("prov-nombre");
    const nombre = elNombre ? elNombre.value.trim() : "";
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
            const form = document.getElementById("form-proveedor");
            if (form) form.reset();
            const cont = document.getElementById("contenedor-mercancias");
            if (cont) {
                cont.innerHTML = `
                    <div class="flex gap-2 text-xs">
                        <input type="text" class="input-mercancia w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white" placeholder="Producto" required>
                    </div>
                `;
            }
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
    const tbodyMovs = document.getElementById("tabla-reportes-body");
    const tbodyProds = document.getElementById("tabla-productos-activos-body");
    const filtroProv = document.getElementById("reporte-filtro-proveedor") ? document.getElementById("reporte-filtro-proveedor").value : "";
    const filtroTipo = document.getElementById("reporte-filtro-tipo") ? document.getElementById("reporte-filtro-tipo").value : "todos";

    if (!tbodyMovs) return;
    tbodyMovs.innerHTML = "";
    if (tbodyProds) tbodyProds.innerHTML = "";

    let totalPrepagoBs = 0;
    let totalLiquidadoBs = 0;
    let totalAjusteBs = 0;
    let contadorOps = 0;

    const resumenProductos = {}; 
    let granTotalBultosActivos = 0;
    let granTotalUsdActivos = 0;

    if (cacheUltimosDatos && cacheUltimosDatos.data && Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        cacheUltimosDatos.data.detallesLotes.forEach(l => {
            if (!filtroProv || l.proveedor === filtroProv) {
                const bultosDisponibles = parseFloat(l.cantDisponible) || 0;
                const costoUsd = parseFloat(l.costoUsd) || 0;

                if (bultosDisponibles > 0) {
                    const prodNombre = l.producto || "Sin Especificar";
                    const totalUsdLote = bultosDisponibles * costoUsd;

                    if (!resumenProductos[prodNombre]) {
                        resumenProductos[prodNombre] = {
                            bultos: 0,
                            totalUsd: 0,
                            costos: []
                        };
                    }

                    resumenProductos[prodNombre].bultos += bultosDisponibles;
                    resumenProductos[prodNombre].totalUsd += totalUsdLote;
                    resumenProductos[prodNombre].costos.push(costoUsd);

                    granTotalBultosActivos += bultosDisponibles;
                    granTotalUsdActivos += totalUsdLote;
                }
            }
        });
    }

    if (tbodyProds) {
        const nombresProductos = Object.keys(resumenProductos);
        if (nombresProductos.length === 0) {
            tbodyProds.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-xs text-slate-500 italic">No hay mercancía prepagada activa para mostrar.</td></tr>`;
        } else {
            nombresProductos.forEach(prod => {
                const item = resumenProductos[prod];
                const costoPromedio = item.bultos > 0 ? (item.totalUsd / item.bultos) : 0;
                const porcentaje = granTotalUsdActivos > 0 ? ((item.totalUsd / granTotalUsdActivos) * 100).toFixed(1) : 0;

                tbodyProds.insertAdjacentHTML("beforeend", `
                    <tr class="hover:bg-slate-900/40 border-b border-slate-800/40">
                        <td class="px-4 py-2 font-bold text-white flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-cyan-400"></span> ${prod}
                        </td>
                        <td class="px-4 py-2 text-right font-mono font-bold text-amber-400">${formatearMonto(item.bultos)} bultos</td>
                        <td class="px-4 py-2 text-right font-mono text-slate-300">$${formatearMonto(costoPromedio)}</td>
                        <td class="px-4 py-2 text-right font-mono font-bold text-emerald-400">$${formatearMonto(item.totalUsd)}</td>
                        <td class="px-4 py-2 text-center">
                            <span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">${porcentaje}%</span>
                        </td>
                    </tr>
                `);
            });
        }
    }

    if (document.getElementById("resumen-total-bultos-activos")) document.getElementById("resumen-total-bultos-activos").innerText = `${formatearMonto(granTotalBultosActivos)} bultos`;
    if (document.getElementById("resumen-total-usd-activos")) document.getElementById("resumen-total-usd-activos").innerText = `$${formatearMonto(granTotalUsdActivos)}`;
    if (document.getElementById("aud-kpi-total-usd-activo")) document.getElementById("aud-kpi-total-usd-activo").innerText = `$${formatearMonto(granTotalUsdActivos)}`;

    const listaRender = [];

    if ((filtroTipo === "todos" || filtroTipo === "prepagos") && cacheUltimosDatos && cacheUltimosDatos.data && Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        cacheUltimosDatos.data.detallesLotes.forEach(l => {
            if (!filtroProv || l.proveedor === filtroProv) {
                const cantOrig = parseFloat(l.cantOriginal) || 0;
                const costoUsd = parseFloat(l.costoUsd) || 0;
                const tasaOrig = parseFloat(l.tasaOriginal) || 0;
                const cantDisp = parseFloat(l.cantDisponible) || 0;

                const totalUsd = cantOrig * costoUsd;
                const totalBs = totalUsd * tasaOrig;
                
                totalPrepagoBs += totalBs;
                contadorOps++;

                // Botón de Edición condicional integrado de forma limpia
                const botonEditarHtml = `<button onclick="iniciarEdicionPrepago('${l.idLote}')" class="ml-2 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 px-2 py-0.5 rounded text-[10px] font-bold transition">✏️ Editar</button>`;

                const estatusBadge = (cantDisp > 0) 
                    ? `<span class="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVO (${formatearMonto(cantDisp)} PEND.)</span> ${botonEditarHtml}`
                    : `<span class="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">LIQUIDADO / CERRADO</span>`;

                listaRender.push({
                    fecha: formatearFecha(l.fecha),
                    referencia: l.idLote,
                    proveedor: l.proveedor,
                    producto: l.producto,
                    cantidad: cantOrig,
                    tasa: tasaOrig,
                    totalUsd: totalUsd,
                    totalBs: totalBs,
                    badge: estatusBadge
                });
            }
        });
    }

    if ((filtroTipo === "todos" || filtroTipo === "despachos") && Array.isArray(cacheHistorialDespachos) && cacheHistorialDespachos.length > 0) {
        cacheHistorialDespachos.forEach(h => {
            if (!filtroProv || h.proveedor === filtroProv) {
                const cantDesp = parseFloat(h.cantidadDespachada) || 0;
                const costoUnit = parseFloat(h.costoUsdUnit) || 0;
                const tasaRec = parseFloat(h.tasaRecepcion) || 1;
                const tasaOrg = parseFloat(h.tasaOrigen) || tasaRec;

                const totalUsd = cantDesp * costoUnit;
                const totalBsRecepcion = parseFloat(h.totalBsRecepcion) || (totalUsd * tasaRec);
                const totalBsOrigen = totalUsd * tasaOrg;
                const ajusteCambiario = totalBsRecepcion - totalBsOrigen;

                totalLiquidadoBs += totalBsRecepcion;
                totalAjusteBs += ajusteCambiario;
                contadorOps++;

                listaRender.push({
                    fecha: formatearFecha(h.fecha),
                    referencia: `${h.idLote} / Fact: ${h.nroFactura || 'S/N'}`,
                    proveedor: h.proveedor,
                    producto: h.producto,
                    cantidad: cantDesp,
                    tasa: tasaRec || tasaOrg,
                    totalUsd: totalUsd,
                    totalBs: totalBsRecepcion,
                    badge: `<span class="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">DESCARGO FIFO</span>`
                });
            }
        });
    }

    if (document.getElementById("aud-kpi-total-prepago-bs")) document.getElementById("aud-kpi-total-prepago-bs").innerText = formatearMonto(totalPrepagoBs);
    if (document.getElementById("aud-kpi-total-liquidado-bs")) document.getElementById("aud-kpi-total-liquidado-bs").innerText = formatearMonto(totalLiquidadoBs);
    
    const elAjuste = document.getElementById("aud-kpi-ajuste-neto");
    if (elAjuste) {
        elAjuste.innerText = `${totalAjusteBs >= 0 ? '+' : ''}${formatearMonto(totalAjusteBs)} Bs`;
        elAjuste.className = `font-mono text-xl font-bold ${totalAjusteBs >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }
    if (document.getElementById("aud-kpi-total-ops")) document.getElementById("aud-kpi-total-ops").innerText = contadorOps;

    if (listaRender.length === 0) {
        tbodyMovs.innerHTML = `<tr><td colspan="9" class="px-6 py-6 text-center text-xs text-slate-500 italic">No hay registros para mostrar.</td></tr>`;
        return;
    }

    listaRender.forEach(item => {
        tbodyMovs.insertAdjacentHTML("beforeend", `
            <tr class="hover:bg-slate-900/50 border-b border-slate-800">
                <td class="px-4 py-3 font-mono text-slate-400">${item.fecha}</td>
                <td class="px-4 py-3 font-mono font-bold text-blue-400">${item.referencia}</td>
                <td class="px-4 py-3 font-medium text-white">${item.proveedor}</td>
                <td class="px-4 py-3 text-slate-300">${item.producto}</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-white">${formatearMonto(item.cantidad)}</td>
                <td class="px-4 py-3 text-right font-mono text-slate-400">Bs. ${formatearMonto(item.tasa)}</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-slate-200">$${formatearMonto(item.totalUsd)}</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-blue-400">Bs. ${formatearMonto(item.totalBs)}</td>
                <td class="px-4 py-3 text-center">${item.badge}</td>
            </tr>
        `);
    });
}

// LIBRO MAYOR CONTABLE
function parsearFechaSegura(strFecha) {
    if (!strFecha) return new Date(0);
    if (strFecha instanceof Date) return isNaN(strFecha) ? new Date(0) : strFecha;
    
    if (/^\d{4}-\d{2}-\d{2}/.test(strFecha)) {
        const d = new Date(strFecha.substring(0, 10) + "T00:00:00");
        return isNaN(d) ? new Date(0) : d;
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(strFecha)) {
        const partes = strFecha.split('/');
        const d = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`);
        return isNaN(d) ? new Date(0) : d;
    }
    
    const d = new Date(strFecha);
    return isNaN(d) ? new Date(0) : d;
}

function renderizarLibroMayor() {
    const tbody = document.getElementById("tabla-libro-mayor-body");
    const elDesde = document.getElementById("mayor-fecha-desde");
    const elHasta = document.getElementById("mayor-fecha-hasta");
    
    if (!tbody) return;
    tbody.innerHTML = "";

    const fechaDesde = elDesde && elDesde.value ? new Date(elDesde.value + "T00:00:00") : null;
    const fechaHasta = elHasta && elHasta.value ? new Date(elHasta.value + "T23:59:59") : null;

    let movimientos = [];

    let mapaLotes = {};
    if (cacheUltimosDatos && cacheUltimosDatos.data && Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        cacheUltimosDatos.data.detallesLotes.forEach(l => {
            const idLoteKey = l.idLote || l.lote || l.numLote;
            if (idLoteKey) {
                mapaLotes[idLoteKey] = {
                    costoUsd: parseFloat(l.costoUsd || l.precioUsd || l.costoUnitario) || 0,
                    tasaOriginal: parseFloat(l.tasaOriginal || l.tasa || l.tasaCambio) || 0,
                    proveedor: l.proveedor || l.nombreProveedor || '-',
                    producto: l.producto || l.nombreProducto || '-'
                };
            }
        });
    }

    if (cacheUltimosDatos && cacheUltimosDatos.data && Array.isArray(cacheUltimosDatos.data.detallesLotes)) {
        cacheUltimosDatos.data.detallesLotes.forEach(l => {
            const cantOrig = parseFloat(l.cantOriginal || l.cantidad || l.cantUnidades || l.cantidadTotal) || 0;
            const costoUsd = parseFloat(l.costoUsd || l.precioUsd || l.costoUnitario) || 0;
            const tasaOrig = parseFloat(l.tasaOriginal || l.tasa || l.tasaCambio) || 0;
            const debeBs = parseFloat(l.totalBs || l.montoBs || l.montoTotalBs) || (cantOrig * costoUsd * tasaOrig);
            const fechaVal = l.fecha || l.fechaPrepago || l.fechaRegistro;

            movimientos.push({
                fechaStr: formatearFecha(fechaVal),
                fechaObj: parsearFechaSegura(fechaVal),
                proveedor: l.proveedor || l.nombreProveedor || '-',
                producto: l.producto || l.nombreProducto || '-',
                referencia: l.idLote || l.lote || l.numLote || '-',
                cantidad: cantOrig,
                debe: debeBs,
                haber: 0
            });
        });
    }

    if (Array.isArray(cacheHistorialDespachos)) {
        cacheHistorialDespachos.forEach(h => {
            let cantDesp = 0;
            const possibleCantKeys = ['cantidadDespachada', 'cantDespachada', 'cantidad', 'cantRecibida', 'cantidadRecibida', 'unidades', 'cantidadUnidades', 'cantUnidades', 'cantidadConsumida', 'cantConsumida', 'qty', 'cantidadMovimiento', 'cant'];
            for (let key of possibleCantKeys) {
                if (h[key] !== undefined && h[key] !== null && !isNaN(parseFloat(h[key]))) {
                    cantDesp = parseFloat(h[key]);
                    if (cantDesp > 0) break;
                }
            }
            if (cantDesp === 0) {
                for (let k in h) {
                    if (k.toLowerCase().includes('cant') || k.toLowerCase().includes('unid') || k.toLowerCase().includes('qty')) {
                        const val = parseFloat(h[k]);
                        if (!isNaN(val) && val > 0) {
                            cantDesp = val;
                            break;
                        }
                    }
                }
            }

            const idLoteRef = h.idLote || h.lote || h.numLote || h.loteAsignado || '';
            const loteInfo = mapaLotes[idLoteRef] || {};
            
            const costoUsd = loteInfo.costoUsd || parseFloat(h.costoUsdUnit || h.costoUnitario || h.precioUsd || h.costoUsd || h.costo) || 0;
            const tasaOrig = loteInfo.tasaOriginal || parseFloat(h.tasaRecepcion || h.tasa || h.tasaCambio || 1) || 1;
            
            let haberBs = 0;
            const possibleBsKeys = ['totalBsRecepcion', 'montoBs', 'totalBs', 'montoRecepcion', 'montoTotalBs', 'totalBsDespacho', 'montoBsDespacho', 'totalBolivares', 'subtotalBs', 'total', 'monto', 'importeBs'];
            for (let key of possibleBsKeys) {
                if (h[key] !== undefined && h[key] !== null && !isNaN(parseFloat(h[key]))) {
                    haberBs = parseFloat(h[key]);
                    if (haberBs > 0) break;
                }
            }
            if (haberBs === 0) {
                haberBs = cantDesp * costoUsd * tasaOrig;
            }
            
            const fechaVal = h.fecha || h.fechaRecepcion || h.fechaRegistro || h.fechaDespacho;
            const facturaRef = h.nroFactura || h.factura || h.numeroFactura || 'S/N';

            movimientos.push({
                fechaStr: formatearFecha(fechaVal),
                fechaObj: parsearFechaSegura(fechaVal),
                proveedor: h.proveedor || loteInfo.proveedor || h.nombreProveedor || '-',
                producto: h.producto || loteInfo.producto || h.nombreProducto || '-',
                referencia: `${idLoteRef || 'S/L'} / Fact: ${facturaRef}`,
                cantidad: cantDesp,
                debe: 0,
                haber: haberBs
            });
        });
    }

    movimientos.sort((a, b) => a.fechaObj - b.fechaObj);

    let saldoAcumulado = 0;
    let totalDebe = 0;
    let totalHaber = 0;
    let contadorFilas = 0;

    movimientos.forEach(m => {
        saldoAcumulado += (m.debe - m.haber);

        if (fechaDesde && m.fechaObj < fechaDesde) return;
        if (fechaHasta && m.fechaObj > fechaHasta) return;

        totalDebe += m.debe;
        totalHaber += m.haber;
        contadorFilas++;

        tbody.insertAdjacentHTML("beforeend", `
            <tr class="hover:bg-slate-900/50 border-b border-slate-800">
                <td class="px-4 py-3 font-mono text-xs text-slate-400">${m.fechaStr}</td>
                <td class="px-4 py-3 text-xs font-medium text-white">${m.proveedor}</td>
                <td class="px-4 py-3 text-xs text-slate-300">${m.producto}</td>
                <td class="px-4 py-3 font-mono text-xs font-bold text-blue-400">${m.referencia}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-white">${formatearMonto(m.cantidad)}</td>
                <td class="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-400">${m.debe > 0 ? 'Bs. ' + formatearMonto(m.debe) : '-'}</td>
                <td class="px-4 py-3 text-right font-mono text-xs font-bold text-amber-400">${m.haber > 0 ? 'Bs. ' + formatearMonto(m.haber) : '-'}</td>
                <td class="px-4 py-3 text-right font-mono text-xs font-bold ${saldoAcumulado >= 0 ? 'text-blue-400' : 'text-red-400'}">Bs. ${formatearMonto(saldoAcumulado)}</td>
            </tr>
        `);
    });

    if (contadorFilas === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-6 text-center text-xs text-slate-500 italic">No se encontraron movimientos en el rango de fechas seleccionado.</td></tr>`;
    }

    if (document.getElementById("mayor-total-debe")) document.getElementById("mayor-total-debe").innerText = "Bs. " + formatearMonto(totalDebe);
    if (document.getElementById("mayor-total-haber")) document.getElementById("mayor-total-haber").innerText = "Bs. " + formatearMonto(totalHaber);
    if (document.getElementById("mayor-saldo-final")) document.getElementById("mayor-saldo-final").innerText = "Bs. " + formatearMonto(saldoAcumulado);
}

function imprimirReporteAuditoria() {
    const elProv = document.getElementById("reporte-filtro-proveedor");
    const elTipo = document.getElementById("reporte-filtro-tipo");
    
    const prov = (elProv && elProv.value) ? elProv.value : "Todos los Proveedores";
    const tipo = (elTipo && elTipo.selectedIndex >= 0) ? elTipo.options[elTipo.selectedIndex].text : "Todos";
    const fechaImpresion = formatearFecha(new Date().toISOString());

    const elPrepagoBs = document.getElementById("aud-kpi-total-prepago-bs");
    const elLiquidadoBs = document.getElementById("aud-kpi-total-liquidado-bs");
    const elAjusteBs = document.getElementById("aud-kpi-ajuste-neto");

    const prepagoBs = elPrepagoBs ? elPrepagoBs.innerText : "0,00";
    const liquidadoBs = elLiquidadoBs ? elLiquidadoBs.innerText : "0,00";
    const ajusteBs = elAjusteBs ? elAjusteBs.innerText : "0,00 Bs";

    let filasHtml = "";
    const tbody = document.getElementById("tabla-reportes-body");
    if (tbody) {
        const trs = tbody.querySelectorAll("tr");
        trs.forEach(tr => {
            const cols = tr.querySelectorAll("td");
            if (cols.length >= 9) {
                filasHtml += `
                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                        <td style="padding: 6px;">${cols[0].innerText}</td>
                        <td style="padding: 6px; font-weight: bold; font-family: monospace;">${cols[1].innerText}</td>
                        <td style="padding: 6px;">${cols[2].innerText}</td>
                        <td style="padding: 6px;">${cols[3].innerText}</td>
                        <td style="padding: 6px; text-align: right; font-family: monospace;">${cols[4].innerText}</td>
                        <td style="padding: 6px; text-align: right; font-family: monospace;">${cols[5].innerText}</td>
                        <td style="padding: 6px; text-align: right; font-family: monospace;">${cols[6].innerText}</td>
                        <td style="padding: 6px; text-align: right; font-family: monospace; font-weight: bold;">${cols[7].innerText}</td>
                        <td style="padding: 6px; text-align: center;">${cols[8].innerText}</td>
                    </tr>
                `;
            }
        });
    }

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;

    win.document.write(`
        <html>
        <head>
            <title>Informe de Auditoría y Trazabilidad - SICOOP</title>
            <style>
                @page { size: letter landscape; margin: 30px; }
                body { font-family: sans-serif; color: #1e293b; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: #0f172a; color: white; padding: 8px; font-size: 10px; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <h2>SICOOP COOPERATIVA - INFORME GENERAL DE AUDITORÍA</h2>
            <p><strong>Proveedor:</strong> ${prov} | <strong>Filtro:</strong> ${tipo} | <strong>Fecha de emisión:</strong> ${fechaImpresion}</p>
            
            <div style="display: flex; gap: 20px; margin: 15px 0;">
                <div style="border:1px solid #cbd5e1; padding:10px; border-radius:5px; width:30%;">
                    <small>Total Prepagado</small><br><strong>Bs. ${prepagoBs}</strong>
                </div>
                <div style="border:1px solid #cbd5e1; padding:10px; border-radius:5px; width:30%;">
                    <small>Total Liquidado</small><br><strong>Bs. ${liquidadoBs}</strong>
                </div>
                <div style="border:1px solid #cbd5e1; padding:10px; border-radius:5px; width:30%;">
                    <small>Ajuste Cambiario Neto</small><br><strong>${ajusteBs}</strong>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Lote / Factura</th>
                        <th>Proveedor</th>
                        <th>Producto</th>
                        <th style="text-align:right;">Cantidad</th>
                        <th style="text-align:right;">Tasa BCV</th>
                        <th style="text-align:right;">Total ($)</th>
                        <th style="text-align:right;">Monto Bs.</th>
                        <th>Estatus</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasHtml}
                </tbody>
            </table>
            <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
        </html>
    `);
    win.document.close();
}

// ==========================================
// SISTEMA DE SEGURIDAD DINÁMICA Y VALIDACIÓN MAESTRA
// ==========================================
function solicitarPinSeguridad(accion) {
    accionPendienteSeguridad = accion;
    const modal = document.getElementById("modal-seguridad");
    if (!modal) {
        alert("⚠️ No se encontró el componente visual del Modal de Seguridad en el HTML.");
        return;
    }
    
    // Soporte seguro para ambos IDs (`input-pin-seguridad` y `input-codigo-seguridad`)
    const inputPin = document.getElementById("input-pin-seguridad") || document.getElementById("input-codigo-seguridad");
    if (inputPin) inputPin.value = "";
    
    const infoContainer = document.getElementById("info-envio-otp");
    if (infoContainer) infoContainer.innerText = "Enviando código de seguridad o ingrese su clave maestra...";

    modal.classList.remove("hidden");

    const payload = {
        accion: "enviar_pin_seguridad",
        data: { correoDestino: "prepagodemercancia@gmail.com" }
    };

    window.respuestaPinGoogle = function(res) {
        if (res && res.status === "success") {
            codigoOtpActual = String(res.pin);
            otpTimestamp = new Date().getTime();
            if (infoContainer) infoContainer.innerText = "✅ Código enviado con éxito a prepagodemercancia@gmail.com. Revise su bandeja o ingrese la clave maestra.";
        } else {
            if (infoContainer) infoContainer.innerText = "⚠️ Clave maestra o sistema alternativo listo.";
        }
        const loader = document.getElementById('jsonp-pin-loader');
        if (loader) loader.remove();
    };

    const scriptPin = document.createElement('script');
    scriptPin.id = 'jsonp-pin-loader';
    const datosSerializados = encodeURIComponent(JSON.stringify(payload));
    scriptPin.src = `${WEB_APP_URL}${WEB_APP_URL.includes('?') ? '&' : '?'}callback=respuestaPinGoogle&payload=${datosSerializados}`;
    
    scriptPin.onerror = function() {
        if (infoContainer) infoContainer.innerText = "⚠️ Validación por clave maestra activa.";
        const loader = document.getElementById('jsonp-pin-loader');
        if (loader) loader.remove();
    };

    document.body.appendChild(scriptPin);
}

function cerrarModalSeguridad() {
    const modal = document.getElementById("modal-seguridad");
    if (modal) modal.classList.add("hidden");
    accionPendienteSeguridad = null;
    codigoOtpActual = null;
}

function validarPinSeguridad() {
    // Lectura robusta del input utilizando ambos IDs requeridos por compatibilidad HTML
    const inputPin = document.getElementById("input-codigo-seguridad") || document.getElementById("input-pin-seguridad");
    const pinIngresado = inputPin ? inputPin.value.trim() : "";

    // Clave maestra fija estricta solicitada
    const CLAVE_MAESTRA = "010263"; 

    if (!pinIngresado) {
        alert("⚠️ Por favor, ingrese la clave de acceso.");
        return;
    }

    if (pinIngresado === CLAVE_MAESTRA || (codigoOtpActual && pinIngresado === codigoOtpActual)) {
        alert("🔓 Acceso autorizado correctamente.");
        cerrarModalSeguridad();

        // 1. Ejecutar la acción pendiente original si existía
        if (typeof accionPendienteSeguridad === 'function') {
            accionPendienteSeguridad();
        }

        // 2. Habilitar dinámicamente las funciones administrativas
        habilitarFuncionesAdministrativas();

    } else {
        alert("❌ Clave de acceso incorrecta. Intente nuevamente.");
    }
}

// Activación y habilitación limpia de botones de reimpresión y edición avanzada
function habilitarFuncionesAdministrativas() {
    // Activar botón o sección de reimpresión en el módulo de recepción si existe
    const btnReimprimirRec = document.getElementById("btn-imprimir-recepcion");
    if (btnReimprimirRec) {
        btnReimprimirRec.disabled = false;
        btnReimprimirRec.classList.remove("opacity-50", "cursor-not-allowed");
    }

    // Activar botón de reimpresión en prepagos
    const btnReimprimirPre = document.getElementById("btn-imprimir-prepago");
    if (btnReimprimirPre) {
        btnReimprimirPre.disabled = false;
        btnReimprimirPre.classList.remove("opacity-50", "cursor-not-allowed");
    }
}

// Funciones protegidas de Edición y Reimpresión Seguras
function iniciarEdicionPrepago(idLote) {
    solicitarPinSeguridad(function() {
        const loteEncontrado = cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.detallesLotes ? 
            cacheUltimosDatos.data.detallesLotes.find(l => l.idLote === idLote) : null;
        
        if (!loteEncontrado) {
            alert("No se encontró el lote para editar.");
            return;
        }

        cambiarModulo('mod-prepagos');
        
        const elProv = document.getElementById("pre-proveedor");
        if (elProv) {
            elProv.value = loteEncontrado.proveedor;
            actualizarFlujoProveedorPrepago(loteEncontrado.proveedor);
        }

        const elLoteSugerido = document.getElementById("pre-lote-sugerido");
        if (elLoteSugerido) elLoteSugerido.innerText = loteEncontrado.idLote;

        const elTasa = document.getElementById("pre-tasa");
        if (elTasa) elTasa.value = loteEncontrado.tasaOriginal || 1;

        const elFecha = document.getElementById("pre-fecha");
        if (elFecha && loteEncontrado.fecha) {
            elFecha.value = loteEncontrado.fecha.split('T')[0];
        }

        const contItems = document.getElementById("contenedor-items-prepago");
        if (contItems) {
            contItems.innerHTML = "";
            agregarFilaMercanciaPrepago();
            const fila = contItems.querySelector(".item-fila-prepago");
            if (fila) {
                const prodSel = fila.querySelector(".item-producto");
                const cantInp = fila.querySelector(".item-cantidad");
                const costoInp = fila.querySelector(".item-costo-usd");
                
                if (prodSel) prodSel.value = loteEncontrado.producto;
                if (cantInp) cantInp.value = loteEncontrado.cantOriginal;
                if (costoInp) costoInp.value = loteEncontrado.costoUsd;
                
                calcularTotalesPrepago();
            }
        }
        
        alert(`✏️ Modo Edición activado para el Lote: ${idLote}. Modifique los valores y presione Guardar.`);
    });
}

function reimpresionSeguraPrepago() {
    solicitarPinSeguridad(function() {
        imprimirReciboPrepago();
    });
}

function reimpresionSeguraRecepcion() {
    solicitarPinSeguridad(function() {
        imprimirComprobanteRecepcion();
    });
}

// INICIALIZACIÓN Y ENLACE AUTOMÁTICO DE EVENTOS EN EL DOM
document.addEventListener("DOMContentLoaded", function() {
    cargarDatos();

    const formPrepago = document.getElementById("form-prepago");
    if (formPrepago) {
        formPrepago.addEventListener("submit", procesarEnvioPrepago);
    }

    const formRecepcion = document.getElementById("form-recepcion");
    if (formRecepcion) {
        formRecepcion.addEventListener("submit", procesarEnvioRecepcion);
    }

    const formProveedor = document.getElementById("form-proveedor");
    if (formProveedor) {
        formProveedor.addEventListener("submit", procesarEnvioProveedor);
    }

    const elTasaPrepago = document.getElementById("pre-tasa");
    if (elTasaPrepago) {
        elTasaPrepago.addEventListener("input", calcularTotalesPrepago);
    }

    const elMayorDesde = document.getElementById("mayor-fecha-desde");
    if (elMayorDesde) {
        elMayorDesde.addEventListener("change", renderizarLibroMayor);
    }

    const elMayorHasta = document.getElementById("mayor-fecha-hasta");
    if (elMayorHasta) {
        elMayorHasta.addEventListener("change", renderizarLibroMayor);
    }
});

window.addEventListener('resize', function() {
    if (chartsCargados && cacheUltimosDatos && cacheUltimosDatos.data && cacheUltimosDatos.data.resumenConsolidated) {
        const modDashboard = document.getElementById('mod-dashboard');
        if (modDashboard && !modDashboard.classList.contains('hidden')) {
            dibujarGraficos(cacheUltimosDatos.data.resumenConsolidated);
        }
    }
});
