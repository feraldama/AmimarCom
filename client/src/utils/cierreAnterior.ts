import Swal from "sweetalert2";
import { cargarEnCierreAnterior } from "../services/registros.service";
import { pedirMotivo } from "./confirmarEliminacion";

// Un supervisor agrega movimientos desde Diferencias de Cierre sólo a cierres
// de los últimos DIAS_TOPE_SUPERVISOR días (mismo tope que
// cierrediferencia.controller)
export const DIAS_TOPE_SUPERVISOR = 15;

// Primer día (YYYY-MM-DD, hora local) en que un supervisor puede cargar
export const primerDiaCargable = () => {
  const d = new Date();
  d.setDate(d.getDate() - DIAS_TOPE_SUPERVISOR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Código con el que el backend rechaza un alta fechada en un turno ya cerrado
// de la caja (ver RegistroDiarioCaja.validarFechaEnTurno)
export const esTurnoCerrado = (error: unknown) =>
  (error as { codigo?: string })?.codigo === "TURNO_CERRADO";

// Cuando una pestaña de caja (Cobranza, Western, JSI) recibe TURNO_CERRADO, ofrece
// cargar el movimiento en el cierre de ese día: pide el motivo y lo manda al
// backend, que lo asigna a ese cierre, recalcula su diferencia y mueve las
// cajas (sin tocar la caja del cajero ni el turno en curso). Devuelve true si
// quedó cargado; false si el usuario canceló o falló (ya se le mostró el error).
export const ofrecerCargaEnCierreAnterior = async (
  datos: Record<string, unknown>
): Promise<boolean> => {
  const motivo = await pedirMotivo({
    titulo: "Es de un turno ya cerrado",
    texto:
      "La fecha es de un turno de esta caja que ya se cerró. Se va a cargar en el cierre de ese día: se recalcula su diferencia y el turno de hoy no cambia.",
    label: "Motivo",
    placeholder: "Ej.: se olvidó cargar ayer",
    confirmar: "Cargar en ese cierre",
  });
  if (motivo === null) return false;
  try {
    const respuesta = await cargarEnCierreAnterior({ ...datos, Motivo: motivo });
    await Swal.fire({ icon: "success", title: "Cargado", text: respuesta.message });
    return true;
  } catch (error) {
    Swal.fire(
      "Error",
      (error as { message?: string })?.message || "No se pudo cargar en el cierre anterior",
      "error"
    );
    return false;
  }
};
