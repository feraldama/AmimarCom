import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { formatMiles } from "../../utils/utils";

interface PaymentModalProps {
  show: boolean;
  handleClose: () => void;
  totalCost: number;
  totalRest: number;
  setTotalRest: (v: number) => void;
  efectivo: number;
  setEfectivo: (v: number) => void;
  banco: number;
  setBanco: (v: number) => void;
  bancoDebito: number;
  setBancoDebito: (v: number) => void;
  bancoCredito: number;
  setBancoCredito: (v: number) => void;
  cuentaCliente: number;
  setCuentaCliente: (v: number) => void;
  sendRequest: () => Promise<void>;
  setPrintTicket: (v: boolean) => void;
  printTicket: boolean;
  voucher: number;
  setVoucher: (v: number) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  show,
  handleClose,
  totalCost,
  totalRest,
  setTotalRest,
  efectivo,
  setEfectivo,
  banco,
  setBanco,
  bancoDebito,
  setBancoDebito,
  bancoCredito,
  setBancoCredito,
  cuentaCliente,
  setCuentaCliente,
  sendRequest,
  setPrintTicket,
  printTicket,
  voucher,
  setVoucher,
}) => {
  const [pagoTipo, setPagoTipoLocal] = useState<
    "E" | "B" | "D" | "CR" | "C" | "V"
  >("E");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setEfectivo(0);
      setBanco(0);
      setBancoDebito(0);
      setBancoCredito(0);
      setCuentaCliente(0);
      setTotalRest(totalCost);
      setTimeout(() => {
        const efectivoInput = document.getElementById("efectivo-input");
        if (efectivoInput) {
          efectivoInput.focus();
        }
      }, 100);
    }
  }, [
    show,
    setEfectivo,
    setBanco,
    setBancoDebito,
    setBancoCredito,
    setCuentaCliente,
    setTotalRest,
    totalCost,
  ]);

  const onNumberClickModal = (label: string | number) => {
    let efe = efectivo;
    let ban = banco;
    let deb = bancoDebito;
    let cred = bancoCredito;
    let cuentaCli = cuentaCliente;
    let vou = voucher;
    let totalResto = 0;

    const append = (val: number, label: string | number) => {
      if (val === 0) return Number(label);
      return Number(`${val}${label}`);
    };

    if (pagoTipo === "E") {
      efe = append(efectivo, label);
      totalResto =
        totalCost -
        efe -
        banco -
        bancoDebito -
        bancoCredito -
        cuentaCliente -
        vou;
      setEfectivo(efe);
    } else if (pagoTipo === "B") {
      ban = append(banco, label);
      totalResto =
        totalCost -
        efectivo -
        ban -
        bancoDebito -
        bancoCredito -
        cuentaCliente -
        vou;
      setBanco(ban);
    } else if (pagoTipo === "D") {
      deb = append(bancoDebito, label);
      totalResto =
        totalCost -
        efectivo -
        banco -
        bancoCredito -
        cuentaCliente -
        deb * 1.03 -
        vou;
      setBancoDebito(deb);
    } else if (pagoTipo === "CR") {
      cred = append(bancoCredito, label);
      totalResto =
        totalCost -
        efectivo -
        banco -
        bancoDebito -
        cuentaCliente -
        cred * 1.05 -
        vou;
      setBancoCredito(cred);
    } else if (pagoTipo === "C") {
      cuentaCli = append(cuentaCliente, label);
      totalResto =
        totalCost -
        efectivo -
        banco -
        bancoDebito -
        bancoCredito -
        cuentaCli -
        vou;
      setCuentaCliente(cuentaCli);
    } else if (pagoTipo === "V") {
      vou = append(voucher, label);
      totalResto =
        totalCost -
        efectivo -
        banco -
        bancoDebito -
        bancoCredito -
        cuentaCliente -
        vou;
      setVoucher(vou);
    }
    setTotalRest(totalResto);
  };

  const cerarCantidadModal = () => {
    let totalResto = 0;
    if (pagoTipo === "E") {
      totalResto =
        totalCost -
        banco -
        bancoDebito -
        bancoCredito -
        cuentaCliente -
        voucher;
      setEfectivo(0);
    } else if (pagoTipo === "B") {
      totalResto =
        totalCost -
        efectivo -
        bancoDebito -
        bancoCredito -
        cuentaCliente -
        voucher;
      setBanco(0);
    } else if (pagoTipo === "D") {
      totalResto =
        totalCost - efectivo - banco - bancoCredito - cuentaCliente - voucher;
      setBancoDebito(0);
    } else if (pagoTipo === "CR") {
      totalResto =
        totalCost - efectivo - banco - bancoDebito - cuentaCliente - voucher;
      setBancoCredito(0);
    } else if (pagoTipo === "C") {
      totalResto =
        totalCost - efectivo - banco - bancoDebito - bancoCredito - voucher;
      setCuentaCliente(0);
    } else if (pagoTipo === "V") {
      totalResto =
        totalCost -
        efectivo -
        banco -
        bancoDebito -
        bancoCredito -
        cuentaCliente;
      setVoucher(0);
    }
    setTotalRest(totalResto);
  };

  const handleSendRequest = async () => {
    setIsSubmitting(true);
    try {
      await sendRequest();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSubmitting && totalRest <= 0) {
      handleSendRequest();
    }
  };

  const buttonsPago = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ["00", 0, "000"],
  ];

  if (!show) return null;

  // Clases compartidas de los inputs de monto: activo resalta con la marca.
  const inputClass = (activo: boolean) =>
    `w-[120px] rounded-md border px-2.5 py-1.5 text-right text-base outline-none transition-colors focus:ring-2 focus:ring-brand-300 ${
      activo ? "border-brand-300 bg-brand-50" : "border-gray-300 bg-gray-50"
    }`;
  const labelClass = "mr-2 flex-1 text-right text-base text-gray-700";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
      onKeyPress={handleKeyPress}
      tabIndex={0}
    >
      <div className="relative w-[800px] max-w-[98vw] rounded-xl bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-300 cursor-pointer"
        >
          <X className="size-6" aria-hidden="true" />
        </button>
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          Seleccione un método de pago
        </h2>
        <div className="flex gap-6">
          {/* Columna izquierda */}
          <div className="flex-1">
            {/* TOTAL */}
            <div className="mb-[18px] flex items-center">
              <div className="mr-2 rounded-md bg-slate-100 px-[22px] py-2 text-[22px] font-bold text-slate-600">
                Total
              </div>
              <div className="rounded-md bg-slate-50 px-[22px] py-2 text-[28px] font-bold text-success-600">
                Gs. {formatMiles(totalCost)}
              </div>
            </div>
            {/* Efectivo */}
            <div className="mb-2.5 flex items-center">
              <label htmlFor="efectivo-input" className={labelClass}>
                Efectivo:
              </label>
              <input
                id="efectivo-input"
                type="text"
                value={formatMiles(efectivo)}
                onFocus={(e) => {
                  setPagoTipoLocal("E");
                  // if (efectivo == 0) {
                  //   setEfectivo(totalRest);
                  // setTotalRest(0);
                  // }
                  e.target.select();
                }}
                onChange={(e) => {
                  const newValue = Number(e.target.value.replace(/\D/g, ""));
                  setEfectivo(newValue);
                  const totalResto =
                    totalCost -
                    newValue -
                    banco -
                    bancoDebito -
                    bancoCredito -
                    cuentaCliente -
                    voucher;
                  setTotalRest(totalResto);
                }}
                className={inputClass(pagoTipo === "E")}
              />
            </div>
            {/* Transferencia */}
            <div className="mb-2.5 flex items-center">
              <label htmlFor="transferencia-input" className={labelClass}>
                Transferencia:
              </label>
              <input
                id="transferencia-input"
                type="text"
                value={formatMiles(banco)}
                onFocus={(e) => {
                  setPagoTipoLocal("B");
                  if (banco === 0) {
                    setBanco(totalRest);
                    setTotalRest(0);
                  }
                  e.target.select();
                }}
                onChange={(e) => {
                  const newValue = Number(e.target.value.replace(/\D/g, ""));
                  setBanco(newValue);
                  const totalResto =
                    totalCost -
                    efectivo -
                    newValue -
                    bancoDebito -
                    bancoCredito -
                    cuentaCliente -
                    voucher;
                  setTotalRest(totalResto);
                }}
                className={inputClass(pagoTipo === "B")}
              />
            </div>
            {/* Tarjeta Débito */}
            <div className="mb-2.5 flex items-center">
              <label htmlFor="debito-input" className={labelClass}>
                Tarjeta Débito (3% adicional):
              </label>
              <input
                id="debito-input"
                type="text"
                value={formatMiles(bancoDebito)}
                onFocus={(e) => {
                  setPagoTipoLocal("D");
                  if (bancoDebito === 0) {
                    setBancoDebito(Number((totalRest * 1.03).toFixed(0)));
                    setTotalRest(0);
                  }
                  e.target.select();
                }}
                onChange={(e) => {
                  const newValue = Number(e.target.value.replace(/\D/g, ""));
                  setBancoDebito(newValue);
                  const totalResto =
                    totalCost -
                    efectivo -
                    banco -
                    bancoCredito -
                    cuentaCliente -
                    newValue * 1.03 -
                    voucher;
                  setTotalRest(totalResto);
                }}
                className={inputClass(pagoTipo === "D")}
              />
            </div>
            {/* Tarjeta Crédito */}
            <div className="mb-2.5 flex items-center">
              <label htmlFor="credito-input" className={labelClass}>
                Tarjeta Crédito (5% adicional):
              </label>
              <input
                id="credito-input"
                type="text"
                value={formatMiles(bancoCredito)}
                onFocus={(e) => {
                  setPagoTipoLocal("CR");
                  if (bancoCredito === 0) {
                    setBancoCredito(Number((totalRest * 1.05).toFixed(0)));
                    setTotalRest(0);
                  }
                  e.target.select();
                }}
                onChange={(e) => {
                  const newValue = Number(e.target.value.replace(/\D/g, ""));
                  setBancoCredito(newValue);
                  const totalResto =
                    totalCost -
                    efectivo -
                    banco -
                    bancoDebito -
                    cuentaCliente -
                    newValue * 1.05 -
                    voucher;
                  setTotalRest(totalResto);
                }}
                className={inputClass(pagoTipo === "CR")}
              />
            </div>
            {/* Cuenta Cliente */}
            <div className="mb-2.5 flex items-center">
              <label htmlFor="cuenta-input" className={labelClass}>
                Cuenta de cliente:
              </label>
              <input
                id="cuenta-input"
                type="text"
                value={formatMiles(cuentaCliente)}
                onFocus={(e) => {
                  setPagoTipoLocal("C");
                  if (cuentaCliente === 0) {
                    setCuentaCliente(totalRest);
                    setTotalRest(0);
                  }
                  e.target.select();
                }}
                onChange={(e) => {
                  const newValue = Number(e.target.value.replace(/\D/g, ""));
                  setCuentaCliente(newValue);
                  const totalResto =
                    totalCost -
                    efectivo -
                    banco -
                    bancoDebito -
                    bancoCredito -
                    newValue -
                    voucher;
                  setTotalRest(totalResto);
                }}
                className={inputClass(pagoTipo === "C")}
              />
            </div>
            {/* Voucher */}
            <div className="mb-2.5 flex items-center">
              <label htmlFor="voucher-input" className={labelClass}>
                Voucher:
              </label>
              <input
                id="voucher-input"
                type="text"
                value={formatMiles(voucher)}
                onFocus={(e) => {
                  setPagoTipoLocal("V");
                  if (voucher === 0) {
                    setVoucher(totalRest);
                    setTotalRest(0);
                  }
                  e.target.select();
                }}
                onChange={(e) => {
                  const newValue = Number(e.target.value.replace(/\D/g, ""));
                  setVoucher(newValue);
                  const totalResto =
                    totalCost -
                    efectivo -
                    banco -
                    bancoDebito -
                    bancoCredito -
                    cuentaCliente -
                    newValue;
                  setTotalRest(totalResto);
                }}
                className={inputClass(pagoTipo === "V")}
              />
            </div>
            {/* Vuelto */}
            <div className="mt-6 text-[28px] font-bold text-gray-700">
              Vuelto:{" "}
              <span className={totalRest < 0 ? "text-danger-600" : "text-gray-900"}>
                {totalRest < 0 ? formatMiles(totalRest * -1) : "0"}
              </span>
            </div>
            <div className="mt-[18px] flex items-center gap-2">
              <input
                type="checkbox"
                checked={printTicket}
                onChange={(e) => setPrintTicket(e.target.checked)}
                id="imprimir"
                className="size-4 cursor-pointer accent-brand-600 focus:ring-2 focus:ring-brand-300"
              />
              <label
                htmlFor="imprimir"
                className="cursor-pointer text-[17px] font-medium text-gray-500"
              >
                Imprimir ticket
              </label>
            </div>
          </div>
          {/* Columna derecha: Pad numérico */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="mb-2.5 grid grid-cols-3 gap-2.5">
              {buttonsPago.flat().map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="h-[54px] cursor-pointer rounded-lg border border-gray-200 bg-slate-50 text-[22px] font-semibold text-gray-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  onClick={() => onNumberClickModal(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="h-12 cursor-pointer rounded-lg border border-gray-200 bg-slate-50 text-lg font-medium text-gray-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
              onClick={cerarCantidadModal}
            >
              Borrar
            </button>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            className="cursor-pointer rounded-lg bg-gray-200 px-8 py-2.5 text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`rounded-lg px-8 py-2.5 text-lg font-bold text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-1
              ${
                isSubmitting || totalRest > 0
                  ? "bg-primary-200 cursor-not-allowed"
                  : "bg-primary hover:bg-primary-700 cursor-pointer"
              }
            `}
            onClick={handleSendRequest}
            disabled={isSubmitting || totalRest > 0}
          >
            Facturar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
