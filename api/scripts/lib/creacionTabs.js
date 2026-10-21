// Réplica, para las pruebas, de lo que hace cada pestaña de "Operar Caja" al
// crear un movimiento: inserta las mismas filas y mueve las cajas igual que el
// handleSubmit del tab (client/src/pages/dashboard/tabs/). Así las pruebas
// pueden verificar que eliminar, corregir o reclasificar revierte exactamente
// lo que hizo la creación. Si cambia la lógica de un tab, hay que cambiarla
// también acá.
const crearTabs = ({ realQuery, uno, usuario }) => {
  const sumar = (cajaId, monto) =>
    realQuery(`UPDATE caja SET "CajaMonto" = "CajaMonto" + $2 WHERE "CajaId" = $1`, [
      cajaId,
      monto,
    ]);
  const tipoDeCaja = async (cajaId) =>
    Number((await uno(`SELECT "CajaTipoId" FROM caja WHERE "CajaId" = $1`, [cajaId])).CajaTipoId);
  // Cajas con el gasto en cajagasto (sin repetir), menos la caja del registro
  const demasCajas = async (tipo, grupo, cajaId) =>
    (
      await realQuery(
        `SELECT DISTINCT cg."CajaId", c."CajaTipoId" FROM cajagasto cg
         JOIN caja c ON c."CajaId" = cg."CajaId"
         WHERE cg."TipoGastoId" = $1 AND cg."TipoGastoGrupoId" = $2 AND cg."CajaId" <> $3`,
        [tipo, grupo, cajaId]
      )
    ).rows.map((r) => ({ cajaId: Number(r.CajaId), tipo: Number(r.CajaTipoId) }));
  const insertarRegistro = async ({ cajaId, fecha, tipo, grupo, detalle, monto, cambio = 0, mtcn = 0, cargo = 0 }) =>
    uno(
      `INSERT INTO registrodiariocaja ("CajaId","RegistroDiarioCajaFecha","TipoGastoId","TipoGastoGrupoId",
         "RegistroDiarioCajaCambio","RegistroDiarioCajaDetalle","RegistroDiarioCajaMTCN","RegistroDiarioCajaCargoEnvio",
         "RegistroDiarioCajaMonto","RegistroDiarioCajaPendiente1","RegistroDiarioCajaPendiente2",
         "RegistroDiarioCajaPendiente3","RegistroDiarioCajaPendiente4","UsuarioId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,0,0,$10) RETURNING *`,
      [cajaId, fecha, tipo, grupo, cambio, detalle, mtcn, cargo, monto, usuario]
    );
  const cualquierCliente = async () =>
    (await uno(`SELECT "ClienteId" FROM clientes ORDER BY "ClienteId" LIMIT 1`)).ClienteId;

  // Caja abierta +monto y demás cajas del gasto -monto (JSI, transporte y
  // colegios son siempre ingresos)
  const ingresoAperturadaYDemas = async (registro) => {
    const monto = Number(registro.RegistroDiarioCajaMonto);
    await sumar(registro.CajaId, monto);
    for (const c of await demasCajas(registro.TipoGastoId, registro.TipoGastoGrupoId, registro.CajaId)) {
      await sumar(c.cajaId, -monto);
    }
  };

  return {
    // CobranzaTab y PagoTab: caja abierta egreso -m / ingreso +m; demás cajas
    // del gasto en sentido opuesto, sin conversión por tipo de caja
    cobranza: async ({ cajaId, fecha, tipo, grupo, monto, detalle = "prueba cobranza", cambio = 0 }) => {
      const registro = await insertarRegistro({ cajaId, fecha, tipo, grupo, detalle, monto, cambio });
      await sumar(cajaId, tipo === 1 ? -monto : monto);
      for (const c of await demasCajas(tipo, grupo, cajaId)) {
        await sumar(c.cajaId, tipo === 1 ? monto : -monto);
      }
      return registro;
    },

    // JuntaSaneamientoTab
    jsi: async ({ cajaId, fecha, grupo, monto }) => {
      const cobro = await uno(
        `INSERT INTO jsicobro ("CajaId","JSICobroFecha","ClienteId","JSICobroMonto","JSICobroUsuarioId")
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [cajaId, fecha, await cualquierCliente(), monto, usuario]
      );
      const registro = await insertarRegistro({
        cajaId, fecha, tipo: 2, grupo, monto, detalle: `Cobro JSI | JSICobroId:${cobro.JSICobroId}`,
      });
      await ingresoAperturadaYDemas(registro);
      return { cobro, registro };
    },

    // EmpresasTransporteTab
    transporte: async ({ cajaId, fecha, transporte, monto }) => {
      const pago = await uno(
        `INSERT INTO pagotrans ("CajaId","PagoTransFecha","TransporteId","PagoTransFechaEmbarque","ClienteId",
           "PagoTransMonto","PagoTransUsuarioId") VALUES ($1,$2,$3,$2,$4,$5,$6) RETURNING *`,
        [cajaId, fecha, transporte.TransporteId, await cualquierCliente(), monto, usuario]
      );
      const registro = await insertarRegistro({
        cajaId, fecha, tipo: transporte.TipoGastoId, grupo: transporte.TipoGastoGrupoId, monto,
        detalle: `Pago transporte | PagoTransId:${pago.PagoTransId} TransporteId:${transporte.TransporteId}`,
      });
      await ingresoAperturadaYDemas(registro);
      return { pago, registro };
    },

    // CobranzaColegiosTab (1 mes, sin mora, examen ni descuento)
    colegio: async ({ cajaId, fecha, alumno }) => {
      const cobranza = await uno(
        `INSERT INTO colegiocobranza ("CajaId","ColegioCobranzaFecha","NominaId","ColegioCobranzaMesPagado",
           "ColegioCobranzaMes","ColegioCobranzaDiasMora","ColegioCobranzaExamen","UsuarioId","ColegioCobranzaDescuento")
         VALUES ($1,$2,$3,'OCTUBRE',1,0,0,$4,0) RETURNING *`,
        [cajaId, fecha, alumno.NominaId, usuario]
      );
      const registro = await insertarRegistro({
        cajaId, fecha, tipo: 2, grupo: alumno.TipoGastoGrupoId, monto: Number(alumno.ColegioCursoImporte),
        detalle: `Cobranza Colegio: X - Nómina: A, B | NominaId:${alumno.NominaId} ColegioCobranzaId:${cobranza.ColegioCobranzaId}`,
      });
      await ingresoAperturadaYDemas(registro);
      return { cobranza, registro };
    },

    // WesternPagosTab: pagos (tipo 1) y envíos (tipo 2). Inserta el registro
    // de caja y el de westernenvio con los mismos campos. El cambio sólo se
    // guarda en los grupos USD CON COTIZACION (pagos 8, envíos 15).
    western: async ({ cajaId, fecha, tipo, grupo, monto, cambioDolar = 0 }) => {
      const conCotizacion = (tipo === 1 && grupo === 8) || (tipo === 2 && grupo === 15);
      const cambio = conCotizacion ? cambioDolar : 0;
      const registro = await insertarRegistro({ cajaId, fecha, tipo, grupo, monto, cambio, detalle: "western prueba" });
      const envio = await uno(
        `INSERT INTO westernenvio ("CajaId","WesternEnvioFecha","TipoGastoId","TipoGastoGrupoId","WesternEnvioCambio",
           "WesternEnvioDetalle","WesternEnvioMTCN","WesternEnvioCargoEnvio","WesternEnvioMonto","WesternEnvioUsuarioId","ClienteId")
         VALUES ($1,$2,$3,$4,$5,'western prueba',0,0,$6,$7,$8) RETURNING *`,
        [cajaId, registro.RegistroDiarioCajaFecha, tipo, grupo, cambio, monto, usuario, await cualquierCliente()]
      );
      const divisor = Number(cambioDolar) || 1;
      const pago = tipo === 1;
      const omiteAperturada = grupo === 13 || (pago ? grupo === 20 : grupo === 28);
      if (!omiteAperturada) {
        const t = await tipoDeCaja(cajaId);
        // pago: egreso (-m); envío: ingreso (+m); en cajas de divisa al revés
        await sumar(cajaId, (pago ? -monto : monto) * (t === 3 ? -1 : 1));
      }
      const especialCotizacion = grupo === 13 || (pago ? grupo === 8 : grupo === 15);
      for (const c of await demasCajas(tipo, grupo, cajaId)) {
        const base = especialCotizacion ? monto / divisor : monto;
        // pago: las demás reciben (+); envío: entregan (-); divisa al revés
        await sumar(c.cajaId, (pago ? base : -base) * (c.tipo === 3 ? -1 : 1));
      }
      return { registro, envio };
    },

    // DivisasTab: compra (C) o venta (V). El registro va con el gasto de
    // egreso de la divisa en la compra y con el de ingreso en la venta; la
    // caja de divisa (tipo 3) se busca por los gastos del tipo opuesto y mueve
    // la cantidad de divisa.
    divisa: async ({ cajaId, fecha, divisaId, tipoMovimiento, cantidad, cambio }) => {
      const monto = cantidad * cambio;
      const gastos = (
        await realQuery(`SELECT * FROM divisagasto WHERE "DivisaId" = $1 ORDER BY "DivisaGastoId"`, [divisaId])
      ).rows;
      const compra = tipoMovimiento === "C";
      const movimiento = await uno(
        `INSERT INTO divisamovimiento ("CajaId","DivisaMovimientoFecha","DivisaMovimientoTipo","DivisaId",
           "DivisaMovimientoCambio","DivisaMovimientoCantidad","DivisaMovimientoMonto","UsuarioId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [cajaId, fecha, tipoMovimiento, divisaId, cambio, cantidad, monto, usuario]
      );
      const primero = gastos.find((g) => Number(g.TipoGastoId) === (compra ? 1 : 2)) ?? gastos[0];
      const registro = await insertarRegistro({
        cajaId, fecha, tipo: compra ? 1 : 2, grupo: primero ? primero.TipoGastoGrupoId : 2, monto, cambio,
        detalle: `${compra ? "Compra" : "Venta"} DivisaMovimientoId:${movimiento.DivisaMovimientoId}`,
      });
      await sumar(cajaId, compra ? -monto : monto);
      const actualizadas = new Set();
      for (const g of gastos.filter((x) => Number(x.TipoGastoId) === (compra ? 2 : 1))) {
        const divisaCaja = (
          await demasCajas(g.TipoGastoId, g.TipoGastoGrupoId, -1)
        ).find((c) => c.tipo === 3 && !actualizadas.has(c.cajaId));
        if (divisaCaja) {
          await sumar(divisaCaja.cajaId, compra ? cantidad : -cantidad);
          actualizadas.add(divisaCaja.cajaId);
        }
      }
      return { movimiento, registro };
    },
  };
};

module.exports = { crearTabs };
