# Reglas del proyecto AmimarCom

## Git

- **NUNCA hacer `git commit` ni `git push`.** Dejar siempre los cambios en el
  working tree para que el usuario los revise y commitee/pushee él mismo. No
  crear commits (incluidos reverts) ni subir nada al remoto, aunque el cambio
  parezca terminado.

## Componentes

- **Campos de fecha:** usar SIEMPRE el componente `CampoFecha`
  (`client/src/components/common/CampoFecha.tsx`) en lugar de un
  `<input type="date">` o `<input type="datetime-local">` nativo. Es un
  reemplazo directo (acepta las mismas props: `value`, `onChange` por evento,
  `name`, `id`, `required`, `min`, `max`, `disabled`, `className`). Hace que el
  tabulador salte directo al ícono de calendario, sin detenerse en los segmentos
  día/mes/año, y abre el selector solo cuando el usuario lo activa.
