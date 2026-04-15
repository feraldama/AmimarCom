import { useEffect, useState } from "react";
import type { Cliente } from "../../types/cliente.types";
import ClienteForm from "./ClienteForm";
import Modal from "./Modal";

interface ClienteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCliente?: Cliente | null;
  onSubmit: (formData: Cliente) => void;
  showCodJSI?: boolean;
  defaultUserId?: string;
}

export default function ClienteFormModal({
  isOpen,
  onClose,
  currentCliente,
  onSubmit,
  showCodJSI = true,
  defaultUserId = "",
}: ClienteFormModalProps) {
  const [formData, setFormData] = useState<Cliente>({
    ClienteId: "",
    ClienteRUC: "",
    ClienteNombre: "",
    ClienteApellido: "",
    ClienteDireccion: "",
    ClienteTelefono: "",
    UsuarioId: defaultUserId,
    ClienteCodJSI: "",
  });

  useEffect(() => {
    if (currentCliente) {
      setFormData({ ...currentCliente });
    } else {
      setFormData({
        ClienteId: "",
        ClienteRUC: "",
        ClienteNombre: "",
        ClienteApellido: "",
        ClienteDireccion: "",
        ClienteTelefono: "",
        UsuarioId: defaultUserId,
        ClienteCodJSI: "",
      });
    }
  }, [currentCliente, defaultUserId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const processedValue =
      name === "ClienteNombre" || name === "ClienteApellido"
        ? value.toUpperCase()
        : value;
    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        currentCliente
          ? `Editar cliente: ${currentCliente.ClienteId}`
          : "Crear nuevo cliente"
      }
      size="2xl"
    >
      <ClienteForm
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onCancel={onClose}
        isEditing={!!currentCliente}
        showCodJSI={showCodJSI}
      />
    </Modal>
  );
}
