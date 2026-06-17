const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUTz-A1b6Q2QUZsU_uJC023IWgscqp2Ga-U2WxoORnQuYlLDvebCfIFlYjZBTfb2Ddiw/exec";
        
let cacheProveedores = []; 
let cacheHistorialDespachos = []; 
let cacheUltimosDatos = null;
let chartsCargados = false; 

// FUNCIÓN CLAVE: Formateador numérico regional (Miles: Punto | Decimales: Coma)
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
    
    const titulos = { 'mod-dashboard': 'Dashboard General', 'mod-prepagos': 'Registrar Prepagos', 'mod-recepcion': 'Recepción de Carga', 'mod-proveedores': 'Ficha de Proveedores', 'mod-reportes': 'Reportes y Auditoría' };
    const titleDom = document.getElementById('titulo-modulo'); if (titleDom) titleDom.innerText = titulos[idModulo] || 'Sistema';
    if (idModulo === 'mod-dashboard') cargarDatos();
}

function agregarCampoMercancia() {
    const div = document.createElement('div'); div.className = "flex gap-2 mt-1";
    div.innerHTML = `<input type="text" class="input-mercancia w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white" placeholder="Producto" required><button type="button" onclick="this.parentElement.remove()" class="bg-red-900 text-red-200 px-3 rounded-lg font-bold hover:bg-red-800">-</button>`;
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
            lista.innerHTML += `<div class="p-3 bg-slate-900 rounded-lg border border-slate-800"><p class="font-bold text-sm text-white">${p.nombre}</p><div class="flex flex-wrap gap-1 mt-2">${chips || '<span class="text-xs text-slate-600 italic">Sin mercancía</span>'}</div></div>`;
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
        sumatoriaBancos += parseFloat(inp.value) || 0;
    });

    const diferencia = totalBsObligatorio - sumatoriaBancos;

    document.getElementById("txt-total-usd").innerText = formatearMonto(sumatoriaUsd);
    document.getElementById("txt-total-bs").innerText = formatearMonto(totalBsObligatorio);
    document.getElementById("txt-total-bancos").innerText = formatearMonto(sumatoriaBancos);
    document.getElementById("txt-diferencia").innerText = formatearMonto(Math.abs(diferencia));

    const wrapperDiff = document.getElementById("wrapper-diferencia");
    const btnGuardar = document.getElementById("btn-guardar-prepago");
    const btnImprimir = document.getElementById("btn-imprimir-prepago");

    if (totalBsObligatorio > 0 && Math.abs(diferencia) <= 1) {
        wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-sm bg-emerald-950/60 border border-emerald-800 text-emerald-400";
        wrapperDiff.innerText = "✅ Cuadrado / Conciliación Bancaria Exitosa";
        
        btnGuardar.disabled = false; btnGuardar.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center";
        btnImprimir.disabled = false; btnImprimir.className = "bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1 w-full";
    } else {
        wrapperDiff.className = "p-3 rounded-lg text-center font-bold text-sm bg-red-950/60 border border-red-800 text-red-400";
        wrapperDiff.innerHTML = `Falta por conciliar: <span class="font-mono">${formatearMonto(diferencia)}</span> Bs`;
        
        btnGuardar.disabled = true; btnGuardar.className = "bg-blue-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
        btnImprimir.disabled = true; btnImprimir.className = "bg-slate-800 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition flex items-center justify-center gap-1 w-full";
    }
}

function imprimirReciboPrepago() {
    const prov = document.getElementById("pre-proveedor").value;
    const lote = document.getElementById("pre-lote-sugerido").innerText;
    const tasa = document.getElementById("pre-tasa").value;
    const fecha = document.getElementById("pre-fecha").value;
    
    let htmlItems = "";
    document.querySelectorAll(".item-fila-prepago").forEach(fila => {
        const prod = fila.querySelector(".item-producto").value;
        const cant = fila.querySelector(".item-cantidad").value;
        const cost = fila.querySelector(".item-costo-usd").value;
        const totUsd = parseFloat(cant) * parseFloat(cost);
        htmlItems += `${prod.substring(0,18).padEnd(18)} ${cant.padStart(5)} ${formatearMonto(totUsd).padStart(10)}\n`;
    });

    let htmlBancos = "";
    const bBanesco = parseFloat(document.getElementById("pago-banesco").value) || 0; if(bBanesco>0) htmlBancos += `BANESCO:    ${formatearMonto(bBanesco).padStart(15)} Bs\n`;
    const bMercantil = parseFloat(document.getElementById("pago-mercantil").value) || 0; if(bMercantil>0) htmlBancos += `MERCANTIL:  ${formatearMonto(bMercantil).padStart(15)} Bs\n`;
    const bProvincial = parseFloat(document.getElementById("pago-provincial").value) || 0; if(bProvincial>0) htmlBancos += `PROVINCIAL: ${formatearMonto(bProvincial).padStart(15)} Bs\n`;
    const bBancaribe = parseFloat(document.getElementById("pago-bancaribe").value) || 0; if(bBancaribe>0) htmlBancos += `BANCARIBE:  ${formatearMonto(bBancaribe).padStart(15)} Bs\n`;
    const bActivo = parseFloat(document.getElementById("pago-activo").value) || 0; if(bActivo>0) htmlBancos += `B. ACTIVO:  ${formatearMonto(bActivo).padStart(15)} Bs\n`;

    const tUsd = document.getElementById("txt-total-usd").innerText;
    const tBs = document.getElementById("txt-total-bs").innerText;

    const tkt = document.getElementById("ticket-impresion");
    tkt.innerHTML = `
<pre style="margin:0; font-family:monospace; font-size:12px; color:black; background:white;">
========================================
         SICOOP COOPERATIVA             
    COMPROBANTE DE COMPRA / PREPAGO     
========================================
LOTE:    ${lote}
PROV:    ${prov}
FECHA:   ${fecha}
TASA:    ${formatearMonto(tasa)} Bs/$
----------------------------------------
PRODUCTO           CANT.     TOTAL USD
----------------------------------------
${htmlItems}----------------------------------------
TOTAL MATERIALES:       ${tUsd} USD
TOTAL COMPROMISO:       ${tBs} BS
----------------------------------------
DISTRIBUCIÓN DEL DESEMBOLSO:
${htmlBancos}========================================
        CONTROL DE OPERACIONES          
          MÉTODO INVENTARIO FIFO        
========================================
</pre>
    `;
    window.print();
}

function procesarEnvioPrepago(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-guardar-prepago");
    btn.disabled = true; btn.innerText = "⏳ Guardando en Servidor...";

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

    fetch(WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: JSON.stringify(payload)
    }).then(() => {
        alert(`🚀 Lote ${payload.data.idLote} registrado y procesado exitosamente.`);
        document.getElementById("form-prepago").reset();
        document.getElementById("contenedor-items-prepago").innerHTML = "";
        cambiarModulo("mod-dashboard");
    }).catch(err => {
        alert("Error al comunicar con la base de datos.");
        console.error(err);
        btn.disabled = false; btn.innerText = "💾 Procesar Guardado";
    });
}

function renderizarTablaReportes() {
    const ctx = document.getElementById("tabla-reportes-contenedor"); if (!ctx) return;
    const provFiltro = document.getElementById("rep-proveedor") ? document.getElementById("rep-proveedor").value : "";
    
    ctx.innerHTML = "";
    let filtrados = cacheHistorialDespachos;
    if (provFiltro) { filtrados = cacheHistorialDespachos.filter(x => x.proveedor === provFiltro); }

    if (filtrados.length === 0) {
        ctx.innerHTML = `<p class="p-6 text-center text-slate-500 text-xs italic">No hay historial de auditoría bajo este criterio.</p>`;
        return;
    }

    let html = `
        <table class="w-full text-left text-sm">
            <thead class="bg-slate-900 text-slate-400 text-xs font-bold uppercase">
                <tr>
                    <th class="px-6 py-3">Fecha Recepción</th>
                    <th class="px-6 py-3">ID Lote</th>
                    <th class="px-6 py-3">Proveedor</th>
                    <th class="px-6 py-3">Mercancía</th>
                    <th class="px-6 py-3 text-right">Cant. Despachada</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 text-slate-300">
    `;

    filtrados.forEach(x => {
        html += `
            <tr class="hover:bg-slate-900/40">
                <td class="px-6 py-3 font-mono text-xs">${x.fechaDespacho || 'N/A'}</td>
                <td class="px-6 py-3 font-mono text-xs text-blue-400 font-bold">${x.idLote}</td>
                <td class="px-6 py-3 font-medium">${x.proveedor}</td>
                <td class="px-6 py-3">${x.producto}</td>
                <td class="px-6 py-3 text-right font-mono font-bold text-emerald-400">${formatearMonto(x.cantidadDespachada)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    ctx.innerHTML = html;
}

// Inicialización automática
window.addEventListener("DOMContentLoaded", () => {
    cargarDatos();
});
