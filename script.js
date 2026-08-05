/* ==========================================================================
   SISTEMA FIFO DE COSTOS Y VALORIZACIÓN
   script.js - Control de Lógica y UI
   ========================================================================== */

// Variable global para almacenar en caché los datos cargados del backend
let cacheUltimosDatos = null;

// ==========================================
// 1. INICIALIZACIÓN DEL SISTEMA
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    inicializarEventListeners();
    cargarDatosSistema();
});

/**
 * Registra todos los eventos de la interfaz
 */
function inicializarEventListeners() {
    // Pestañas de Navegación Principal
    const navButtons = document.querySelectorAll(".nav-tab-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.getAttribute("data-tab");
            cambiarPestaña(targetTab);
        });
    });

    // Eventos del Módulo de Despacho
    const desProv = document.getElementById("desp-proveedor");
    const desProd = document.getElementById("desp-producto");
    const desCant = document.getElementById("desp-cantidad");

    if (desProv) desProv.addEventListener("change", recalcularDespacho);
    if (desProd) desProd.addEventListener("change", recalcularDespacho);
    if (desCant) desCant.addEventListener("input", recalcularDespacho);

    // Eventos del Módulo de Recepción
    const recProv = document.getElementById("rec-proveedor");
    const recProd = document.getElementById("rec-producto");
    const recCant = document.getElementById("rec-cantidad");
    const recMontoBs = document.getElementById("rec-monto-bs");

    if (recProv) recProv.addEventListener("change", actualizarTablaRecepcionCascada);
    if (recProd) recProd.addEventListener("change", actualizarTablaRecepcionCascada);
    if (recCant) recCant.addEventListener("input", actualizarTablaRecepcionCascada);
    if (recMontoBs) recMontoBs.addEventListener("input", actualizarTablaRecepcionCascada);

    // Eventos de Formularios (Submit)
    const formDespacho = document.getElementById("form-despacho");
    if (formDespacho) formDespacho.addEventListener("submit", procesarDespacho);

    const formRecepcion = document.getElementById("form-recepcion");
    if (formRecepcion) formRecepcion.addEventListener("submit", procesarRecepcion);

    const formLote = document.getElementById("form-nuevo-lote");
    if (formLote) formLote.addEventListener("submit", procesarNuevoLote);
}

// ==========================================
// 2. CONTROL DE NAVEGACIÓN
// ==========================================

function cambiarPestaña(tabId) {
    const tabs = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => tab.classList.add("hidden"));

    const target = document.getElementById(tabId);
    if (target) target.classList.remove("hidden");

    const navButtons = document.querySelectorAll(".nav-tab-btn");
    navButtons.forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("bg-blue-600", "text-white");
            btn.classList.remove("text-slate-400", "hover:bg-slate-800");
        } else {
            btn.classList.remove("bg-blue-600", "text-white");
            btn.classList.add("text-slate-400", "hover:bg-slate-800");
        }
    });
}

// ==========================================
// 3. CARGA Y PROCESAMIENTO DE DATOS
// ==========================================

async function cargarDatosSistema() {
    mostrarLoader(true);
    try {
        const response = await fetch('/api/datos-inventario');
        if (!response.ok) throw new Error("Error al consultar el servidor");
        
        const data = await response.json();
        cacheUltimosDatos = data;

        actualizarKPIGlobales(data);
        renderizarTablaLotesGeneral(data.detallesLotes);
        poblarSelectores(data);

        recalcularDespacho();
        actualizarTablaRecepcionCascada();

    } catch (error) {
        console.error("Error al cargar datos:", error);
        mostrarNotificacion("Error de conexión al cargar inventario", "error");
    } finally {
        mostrarLoader(false);
    }
}

function actualizarKPIGlobales(data) {
    if (!data || !data.resumen) return;
    const { totalValorUsd, totalValorBs, totalLotesActivos } = data.resumen;

    if (document.getElementById("kpi-global-usd")) {
        document.getElementById("kpi-global-usd").innerText = `$${formatearMonto(totalValorUsd)}`;
    }
    if (document.getElementById("kpi-global-bs")) {
        document.getElementById("kpi-global-bs").innerText = `Bs. ${formatearMonto(totalValorBs)}`;
    }
    if (document.getElementById("kpi-global-lotes")) {
        document.getElementById("kpi-global-lotes").innerText = totalLotesActivos || 0;
    }
}

function renderizarTablaLotesGeneral(lotes) {
    const tbody = document.getElementById("tabla-lotes-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!lotes || lotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-xs text-slate-500 italic">No hay lotes de inventario registrados</td></tr>`;
        return;
    }

    lotes.forEach(lote => {
        const row = document.createElement("tr");
        row.className = "border-b border-slate-800 hover:bg-slate-800/40 transition";
        row.innerHTML = `
            <td class="px-4 py-3 font-mono text-xs text-blue-400 font-bold">${lote.idLote}</td>
            <td class="px-4 py-3 text-xs text-slate-200 font-medium">${lote.proveedor}</td>
            <td class="px-4 py-3 text-xs text-slate-300">${lote.producto}</td>
            <td class="px-4 py-3 text-xs text-right font-mono">${formatearMonto(lote.cantDisponible)}</td>
            <td class="px-4 py-3 text-xs text-right font-mono text-emerald-400">$${formatearMonto(lote.costoUsd)}</td>
            <td class="px-4 py-3 text-xs text-right font-mono text-slate-400">Bs. ${formatearMonto(lote.tasaOriginal)}</td>
            <td class="px-4 py-3 text-xs text-center font-mono">${lote.fechaIngreso}</td>
        `;
        tbody.appendChild(row);
    });
}

function poblarSelectores(data) {
    if (!data || !data.detallesLotes) return;

    const proveedores = [...new Set(data.detallesLotes.map(l => l.proveedor))];
    const productos = [...new Set(data.detallesLotes.map(l => l.producto))];

    const desProv = document.getElementById("desp-proveedor");
    const recProv = document.getElementById("rec-proveedor");
    const desProd = document.getElementById("desp-producto");
    const recProd = document.getElementById("rec-producto");

    if (desProv) rellenarSelect(desProv, proveedores);
    if (recProv) rellenarSelect(recProv, proveedores);
    if (desProd) rellenarSelect(desProd, productos);
    if (recProd) rellenarSelect(recProd, productos);
}

function rellenarSelect(selectEl, listaItems) {
    const valorPrevio = selectEl.value;
    selectEl.innerHTML = `<option value="">-- Seleccionar --</option>`;
    listaItems.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        selectEl.appendChild(opt);
    });
    if (listaItems.includes(valorPrevio)) {
        selectEl.value = valorPrevio;
    }
}

// ==========================================
// 4. LÓGICA DE DESPACHO (FIFO / SALIDAS)
// ==========================================

function recalcularDespacho() {
    const prov = document.getElementById("desp-proveedor") ? document.getElementById("desp-proveedor").value : "";
    const prod = document.getElementById("desp-producto") ? document.getElementById("desp-producto").value : "";
    const cant = parseFloat(document.getElementById("desp-cantidad") ? document.getElementById("desp-cantidad").value : 0) || 0;

    const tbody = document.getElementById("desp-tabla-lotes-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!prov || !prod || !cacheUltimosDatos || !cacheUltimosDatos.data || !cacheUltimosDatos.data.detallesLotes) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-xs text-slate-500 italic">Seleccione un proveedor y producto para calcular FIFO</td></tr>`;
        resetearKPIsDespacho();
        return;
    }

    const lotesDisponibles = cacheUltimosDatos.data.detallesLotes.filter(l => 
        l.proveedor === prov && 
        l.producto === prod && 
        l.cantDisponible > 0
    );

    if (lotesDisponibles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-xs text-amber-500 italic">⚠️ No hay existencias disponibles para esta combinación</td></tr>`;
        resetearKPIsDespacho();
        return;
    }

    let remanente = cant;
    let sumUsd = 0;
    let sumBs = 0;

    lotesDisponibles.forEach(lote => {
        const cantDisponible = lote.cantDisponible;
        let cantTomada = 0;

        if (remanente > 0) {
            cantTomada = Math.min(remanente, cantDisponible);
            remanente -= cantTomada;
        }

        const subtotalUsd = cantTomada * lote.costoUsd;
        const subtotalBs = subtotalUsd * lote.tasaOriginal;

        sumUsd += subtotalUsd;
        sumBs += subtotalBs;

        const row = document.createElement("tr");
        row.className = cantTomada > 0 ? "bg-blue-950/30 border-b border-slate-800" : "opacity-40 border-b border-slate-800";
        row.innerHTML = `
            <td class="px-3 py-2 font-mono text-xs font-bold text-blue-400">${lote.idLote}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">${formatearMonto(cantDisponible)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-emerald-400 font-bold">${formatearMonto(cantTomada)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">$${formatearMonto(lote.costoUsd)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right font-bold text-slate-200">$${formatearMonto(subtotalUsd)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-slate-400">Bs. ${formatearMonto(subtotalBs)}</td>
        `;
        tbody.appendChild(row);
    });

    if (document.getElementById("desp-kpi-usd")) document.getElementById("desp-kpi-usd").innerText = formatearMonto(sumUsd);
    if (document.getElementById("desp-kpi-bs")) document.getElementById("desp-kpi-bs").innerText = formatearMonto(sumBs);

    const btnProcesar = document.getElementById("btn-guardar-despacho");
    if (remanente > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.className = "bg-amber-600/50 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
            btnProcesar.innerText = `⚠️ Cantidad insuficiente (Faltan: ${formatearMonto(remanente)})`;
        }
    } else if (cant > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = false;
            btnProcesar.className = "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center";
            btnProcesar.innerText = "🚀 Confirmar y Procesar Despacho";
        }
    } else {
        resetearKPIsDespacho();
    }
}

function resetearKPIsDespacho() {
    if (document.getElementById("desp-kpi-usd")) document.getElementById("desp-kpi-usd").innerText = "0,00";
    if (document.getElementById("desp-kpi-bs")) document.getElementById("desp-kpi-bs").innerText = "0,00";
    const btn = document.getElementById("btn-guardar-despacho");
    if (btn) {
        btn.disabled = true;
        btn.className = "bg-blue-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
        btn.innerText = "🚀 Confirmar y Procesar Despacho";
    }
}

// ==========================================
// 5. LÓGICA DE RECEPCIÓN / REVALORIZACIÓN
// ==========================================

/**
 * Función que recalcula la tabla FIFO y actualiza correctamente los KPIs
 */
function actualizarTablaRecepcionCascada() {
    const prov = document.getElementById("rec-proveedor") ? document.getElementById("rec-proveedor").value : "";
    const prod = document.getElementById("rec-producto") ? document.getElementById("rec-producto").value : "";
    const cantRecepcion = parseFloat(document.getElementById("rec-cantidad") ? document.getElementById("rec-cantidad").value : 0) || 0;
    const montoFacturaBs = parseFloat(document.getElementById("rec-monto-bs") ? document.getElementById("rec-monto-bs").value : 0) || 0;

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

    // 1. Primer recorrido: calcular total en USD gastados según la cola FIFO
    let remanenteTemporal = cantRecepcion;
    let sumUsdOriginal = 0;
    let sumBsOriginal = 0;

    const lotesProcesados = lotesDisponibles.map(lote => {
        const cantDisponible = lote.cantDisponible;
        let cantTomada = 0;

        if (remanenteTemporal > 0) {
            cantTomada = Math.min(remanenteTemporal, cantDisponible);
            remanenteTemporal -= cantTomada;
        }

        const costoUsdUnit = lote.costoUsd || 0;
        const tasaOrigen = lote.tasaOriginal || 0;
        const totalUsdTomado = cantTomada * costoUsdUnit;
        const totalBsOrigenTomado = totalUsdTomado * tasaOrigen;

        sumUsdOriginal += totalUsdTomado;
        sumBsOriginal += totalBsOrigenTomado;

        return {
            lote,
            cantDisponible,
            cantTomada,
            costoUsdUnit,
            tasaOrigen,
            totalUsdTomado,
            totalBsOrigenTomado
        };
    });

    // 2. Determinar la Tasa Implícita del día basándonos en el input de la Factura (Bs)
    const tasaImplicita = sumUsdOriginal > 0 ? (montoFacturaBs / sumUsdOriginal) : 0;

    let sumBsActual = 0;

    // 3. Renderizar filas con la tasa correcta calculada
    lotesProcesados.forEach(item => {
        // Si hay monto ingresado en la factura usamos la tasa implícita, de lo contrario la tasa de origen
        const totalBsActualTomado = item.cantTomada > 0 
            ? (montoFacturaBs > 0 ? item.totalUsdTomado * tasaImplicita : item.totalBsOrigenTomado) 
            : 0;

        sumBsActual += totalBsActualTomado;

        const row = document.createElement("tr");
        row.className = item.cantTomada > 0 ? "bg-blue-950/30 border-b border-slate-800" : "opacity-40 border-b border-slate-800";
        row.innerHTML = `
            <td class="px-3 py-2 font-mono text-xs font-bold text-blue-400">${item.lote.idLote}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">${formatearMonto(item.cantDisponible)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-emerald-400 font-bold">${formatearMonto(item.cantTomada)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">$${formatearMonto(item.costoUsdUnit)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right font-bold text-slate-200">$${formatearMonto(item.totalUsdTomado)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right">Bs. ${formatearMonto(item.tasaOrigen)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-slate-300">Bs. ${formatearMonto(item.totalBsOrigenTomado)}</td>
            <td class="px-3 py-2 font-mono text-xs text-right text-blue-400 font-bold">Bs. ${formatearMonto(totalBsActualTomado)}</td>
        `;
        tbody.appendChild(row);
    });

    // 4. Actualizar KPIs Superiores
    const valorHoyBs = montoFacturaBs > 0 ? montoFacturaBs : sumBsOriginal;
    const ajusteValorizacionBs = valorHoyBs - sumBsOriginal;

    if (document.getElementById("rec-kpi-usd")) document.getElementById("rec-kpi-usd").innerText = formatearMonto(sumUsdOriginal);
    if (document.getElementById("rec-kpi-bs-origen")) document.getElementById("rec-kpi-bs-origen").innerText = formatearMonto(sumBsOriginal);
    if (document.getElementById("rec-kpi-bs-actual")) document.getElementById("rec-kpi-bs-actual").innerText = formatearMonto(valorHoyBs);

    const kpiAjusteEl = document.getElementById("rec-kpi-ajuste");
    if (kpiAjusteEl) {
        kpiAjusteEl.innerText = `${ajusteValorizacionBs >= 0 ? '+' : ''}${formatearMonto(ajusteValorizacionBs)} Bs`;
        kpiAjusteEl.className = `font-mono text-lg font-bold ${ajusteValorizacionBs >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }

    // 5. Estado del Botón de Guardar
    const btnProcesar = document.getElementById("btn-guardar-recepcion");
    const remanentePorDespachar = cantRecepcion - lotesProcesados.reduce((acc, curr) => acc + curr.cantTomada, 0);

    if (remanentePorDespachar > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.className = "bg-amber-600/50 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
            btnProcesar.innerText = `⚠️ Stock insuficiente (Faltan: ${formatearMonto(remanentePorDespachar)} und)`;
        }
    } else if (cantRecepcion > 0) {
        if (btnProcesar) {
            btnProcesar.disabled = false;
            btnProcesar.className = "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition w-full text-center";
            btnProcesar.innerText = "📦 Confirmar Recepción de Carga";
        }
    } else {
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.className = "bg-emerald-600 opacity-50 cursor-not-allowed font-bold py-2.5 rounded-lg text-xs text-white transition w-full";
            btnProcesar.innerText = "📦 Confirmar Recepción de Carga";
        }
    }
}

function resetearKPIsRecepcion() {
    if (document.getElementById("rec-kpi-usd")) document.getElementById("rec-kpi-usd").innerText = "0,00";
    if (document.getElementById("rec-kpi-bs-origen")) document.getElementById("rec-kpi-bs-origen").innerText = "0,00";
    if (document.getElementById("rec-kpi-bs-actual")) document.getElementById("rec-kpi-bs-actual").innerText = "0,00";
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
}

// ==========================================
// 6. PROCESAMIENTO DE TRANSACCIONES (POST)
// ==========================================

async function procesarDespacho(e) {
    e.preventDefault();
    mostrarLoader(true);

    const payload = {
        proveedor: document.getElementById("desp-proveedor").value,
        producto: document.getElementById("desp-producto").value,
        cantidad: parseFloat(document.getElementById("desp-cantidad").value),
        cliente: document.getElementById("desp-cliente") ? document.getElementById("desp-cliente").value : "",
        referencia: document.getElementById("desp-ref") ? document.getElementById("desp-ref").value : ""
    };

    try {
        const response = await fetch('/api/procesar-despacho', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (res.exito) {
            mostrarNotificacion("✅ Despacho procesado con éxito", "exito");
            document.getElementById("form-despacho").reset();
            await cargarDatosSistema();
        } else {
            mostrarNotificacion(`❌ ${res.mensaje || "Error al procesar despacho"}`, "error");
        }
    } catch (err) {
        console.error(err);
        mostrarNotificacion("Error de conexión al enviar el despacho", "error");
    } finally {
        mostrarLoader(false);
    }
}

async function procesarRecepcion(e) {
    e.preventDefault();
    mostrarLoader(true);

    const payload = {
        proveedor: document.getElementById("rec-proveedor").value,
        producto: document.getElementById("rec-producto").value,
        cantidad: parseFloat(document.getElementById("rec-cantidad").value),
        montoBs: parseFloat(document.getElementById("rec-monto-bs").value),
        observacion: document.getElementById("rec-obs") ? document.getElementById("rec-obs").value : ""
    };

    try {
        const response = await fetch('/api/procesar-recepcion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (res.exito) {
            mostrarNotificacion("📦 Recepción de carga procesada correctamente", "exito");
            document.getElementById("form-recepcion").reset();
            await cargarDatosSistema();
        } else {
            mostrarNotificacion(`❌ ${res.mensaje || "Error al procesar recepción"}`, "error");
        }
    } catch (err) {
        console.error(err);
        mostrarNotificacion("Error de conexión al enviar la recepción", "error");
    } finally {
        mostrarLoader(false);
    }
}

async function procesarNuevoLote(e) {
    e.preventDefault();
    mostrarLoader(true);

    const payload = {
        proveedor: document.getElementById("lote-proveedor").value,
        producto: document.getElementById("lote-producto").value,
        cantidad: parseFloat(document.getElementById("lote-cantidad").value),
        costoUsd: parseFloat(document.getElementById("lote-costo-usd").value),
        tasaBs: parseFloat(document.getElementById("lote-tasa-bs").value)
    };

    try {
        const response = await fetch('/api/nuevo-lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (res.exito) {
            mostrarNotificacion("✨ Nuevo lote registrado en inventario", "exito");
            document.getElementById("form-nuevo-lote").reset();
            await cargarDatosSistema();
        } else {
            mostrarNotificacion(`❌ ${res.mensaje || "Error al crear lote"}`, "error");
        }
    } catch (err) {
        console.error(err);
        mostrarNotificacion("Error de conexión al registrar lote", "error");
    } finally {
        mostrarLoader(false);
    }
}

// ==========================================
// 7. FUNCIONES DE UTILIDAD Y UI
// ==========================================

function formatearMonto(numero) {
    if (isNaN(numero) || numero === null) return "0,00";
    return new Intl.NumberFormat("es-VE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

function mostrarLoader(visible) {
    const loader = document.getElementById("loader-global");
    if (loader) {
        if (visible) loader.classList.remove("hidden");
        else loader.classList.add("hidden");
    }
}

function mostrarNotificacion(mensaje, tipo = "info") {
    const container = document.getElementById("notificaciones-container");
    if (!container) return;

    const notif = document.createElement("div");
    const colores = {
        exito: "bg-emerald-600 text-white border-emerald-400",
        error: "bg-red-600 text-white border-red-400",
        info: "bg-blue-600 text-white border-blue-400"
    };

    notif.className = `p-3 rounded-lg shadow-lg border text-xs font-semibold flex items-center justify-between transition-all duration-300 transform translate-y-2 ${colores[tipo] || colores.info}`;
    notif.innerHTML = `<span>${mensaje}</span>`;

    container.appendChild(notif);

    setTimeout(() => {
        notif.classList.add("opacity-0", "translate-y-[-10px]");
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}
