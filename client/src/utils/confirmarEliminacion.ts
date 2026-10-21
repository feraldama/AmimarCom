import Swal from "sweetalert2";

// Pide un motivo obligatorio en un diálogo. Devuelve el motivo, o null si el
// usuario canceló.
export const pedirMotivo = async ({
  titulo,
  texto,
  label,
  placeholder,
  confirmar,
}: {
  titulo: string;
  texto: string;
  label: string;
  placeholder: string;
  confirmar: string;
}): Promise<string | null> => {
  const result = await Swal.fire({
    title: titulo,
    text: texto,
    icon: "warning",
    input: "text",
    inputLabel: label,
    inputPlaceholder: placeholder,
    inputAttributes: { maxlength: "500" },
    inputValidator: (valor) =>
      valor && valor.trim() ? undefined : "Indicá el motivo",
    showCancelButton: true,
    confirmButtonColor: "#0d9488",
    cancelButtonColor: "#d33",
    confirmButtonText: confirmar,
    cancelButtonText: "Cancelar",
  });
  return result.isConfirmed ? String(result.value).trim() : null;
};

// Confirmación de borrado de un movimiento de caja (o de un cobro que lo
// generó) que pide el motivo. Si el movimiento es de un turno ya cerrado, el
// backend recalcula la diferencia de ese cierre y guarda el motivo en la
// auditoría. Devuelve el motivo, o null si el usuario canceló.
export const confirmarEliminacionConMotivo = (): Promise<string | null> =>
  pedirMotivo({
    titulo: "¿Estás seguro?",
    texto: "¡No podrás revertir esto!",
    label: "Motivo de la eliminación",
    placeholder: "Ej.: se cargó dos veces",
    confirmar: "Sí, eliminar!",
  });
