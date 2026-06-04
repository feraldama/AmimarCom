# Reglas del proyecto AmimarCom

## Componentes

- **Campos de fecha:** usar SIEMPRE el componente `CampoFecha`
  (`client/src/components/common/CampoFecha.tsx`) en lugar de un
  `<input type="date">` o `<input type="datetime-local">` nativo. Es un
  reemplazo directo (acepta las mismas props: `value`, `onChange` por evento,
  `name`, `id`, `required`, `min`, `max`, `disabled`, `className`). Hace que el
  tabulador salte directo al ícono de calendario, sin detenerse en los segmentos
  día/mes/año, y abre el selector solo cuando el usuario lo activa.
