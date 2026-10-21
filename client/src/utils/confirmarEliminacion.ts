import Swal from "sweetalert2";

// Confirmación de borrado de un movimiento de caja (o de un cobro que lo
// generó) que pide el motivo. Si el movimiento es de un turno ya cerrado, el
// backend recalcula la diferencia de ese cierre y guarda el motivo en la
// auditoría. Devuelve el motivo, o null si el usuario canceló.
export const confirmarEliminacionConMotivo = async (): Promise<string | null> => {
  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: "¡No podrás revertir esto!",
    icon: "warning",
    input: "text",
    inputLabel: "Motivo de la eliminación",
    inputPlaceholder: "Ej.: se cargó dos veces",
    inputAttributes: { maxlength: "500" },
    inputValidator: (valor) =>
      valor && valor.trim() ? undefined : "Indicá el motivo",
    showCancelButton: true,
    confirmButtonColor: "#0d9488",
    cancelButtonColor: "#d33",
    confirmButtonText: "Sí, eliminar!",
    cancelButtonText: "Cancelar",
  });
  return result.isConfirmed ? String(result.value).trim() : null;
};
