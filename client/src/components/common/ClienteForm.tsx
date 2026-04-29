import type { Cliente } from "../../types/cliente.types";

interface ClienteFormProps {
  formData: Cliente;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  formId?: string;
  showCodJSI?: boolean;
}

const inputClass =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition-colors";

const labelClass = "block mb-1.5 text-sm font-medium text-gray-700";

export default function ClienteForm({
  formData,
  onInputChange,
  onSubmit,
  formId,
}: ClienteFormProps) {
  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-6 gap-x-4 gap-y-4">
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="ClienteRUC" className={labelClass}>
            RUC
          </label>
          <input
            type="text"
            name="ClienteRUC"
            id="ClienteRUC"
            value={formData.ClienteRUC || ""}
            onChange={onInputChange}
            className={inputClass}
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="ClienteNombre" className={labelClass}>
            Nombre <span className="text-danger-500">*</span>
          </label>
          <input
            type="text"
            name="ClienteNombre"
            id="ClienteNombre"
            value={formData.ClienteNombre || ""}
            onChange={onInputChange}
            className={inputClass}
            required
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="ClienteApellido" className={labelClass}>
            Apellido
          </label>
          <input
            type="text"
            name="ClienteApellido"
            id="ClienteApellido"
            value={formData.ClienteApellido || ""}
            onChange={onInputChange}
            className={inputClass}
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="ClienteDireccion" className={labelClass}>
            Direccion
          </label>
          <input
            type="text"
            name="ClienteDireccion"
            id="ClienteDireccion"
            value={formData.ClienteDireccion || ""}
            onChange={onInputChange}
            className={inputClass}
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="ClienteTelefono" className={labelClass}>
            Telefono
          </label>
          <input
            type="text"
            name="ClienteTelefono"
            id="ClienteTelefono"
            value={formData.ClienteTelefono || ""}
            onChange={onInputChange}
            className={inputClass}
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="ClienteCodJSI" className={labelClass}>
            Codigo JSI
          </label>
          <input
            type="text"
            name="ClienteCodJSI"
            id="ClienteCodJSI"
            value={formData.ClienteCodJSI || ""}
            onChange={onInputChange}
            className={inputClass}
          />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="UsuarioId" className={labelClass}>
            Usuario ID
          </label>
          <input
            type="text"
            name="UsuarioId"
            id="UsuarioId"
            value={formData.UsuarioId || ""}
            readOnly
            disabled
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400">Asignado automaticamente</p>
        </div>
      </div>
    </form>
  );
}
