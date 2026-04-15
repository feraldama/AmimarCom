require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Importar rutas
const usuarioRoutes = require("./routes/usuario.routes");
const registroDiarioCajaRoutes = require("./routes/registrodiariocaja.routes");
const cajaRoutes = require("./routes/caja.routes");
const tipoGastoRoutes = require("./routes/tipogasto.routes");
const clienteRoutes = require("./routes/cliente.routes");
const tipogastoGrupoRoutes = require("./routes/tipogastogrupo.routes");
const productoRoutes = require("./routes/producto.routes");
const localRoutes = require("./routes/local.routes");
const almacenRoutes = require("./routes/almacen.routes");
const comboRoutes = require("./routes/combo.routes");
const perfilRoutes = require("./routes/perfil.routes");
const menuRoutes = require("./routes/menu.routes");
const perfilMenuRoutes = require("./routes/perfilmenu.routes");
const usuarioPerfilRoutes = require("./routes/usuarioperfil.routes");
const ventaProductoRoutes = require("./routes/ventaproducto.routes");
const ventaRoutes = require("./routes/venta.routes");
const ventaCreditoRoutes = require("./routes/ventacredito.routes");
const ventaCreditoPagoRoutes = require("./routes/ventacreditopago.routes");
const facturaRoutes = require("./routes/factura.routes");
const compraRoutes = require("./routes/compra.routes");
const proveedorRoutes = require("./routes/proveedor.routes");
const cajagastoRoutes = require("./routes/cajagasto.routes");
const cajatipoRoutes = require("./routes/cajatipo.routes");
const transporteRoutes = require("./routes/transporte.routes");
const pagotransRoutes = require("./routes/pagotrans.routes");
const colegioRoutes = require("./routes/colegio.routes");
const colegiocursoRoutes = require("./routes/colegiocurso.routes");
const nominaRoutes = require("./routes/nomina.routes");
const colegiocobranzaRoutes = require("./routes/colegiocobranza.routes");
const divisaRoutes = require("./routes/divisa.routes");
const divisaGastoRoutes = require("./routes/divisagasto.routes");
const divisaMovimientoRoutes = require("./routes/divisamovimiento.routes");
const jsicobroRoutes = require("./routes/jsicobro.routes");
const horarioUsoRoutes = require("./routes/horariouso.routes");
const pagoAdminRoutes = require("./routes/pagoadmin.routes");
const westernEnvioRoutes = require("./routes/westernenvio.routes");
// const productoRoutes = require("./routes/producto.routes"); // Ejemplo adicional

const app = express();

// Configuración de CORS
const corsOptions = {
  origin: "*", // Permite todas las origenes
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // 24 horas
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Rutas
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/registrodiariocaja", registroDiarioCajaRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/tipogasto", tipoGastoRoutes);
app.use("/api/clientes", clienteRoutes);
app.use("/api/tipogastogrupo", tipogastoGrupoRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/locales", localRoutes);
app.use("/api/almacen", almacenRoutes);
app.use("/api/combo", comboRoutes);
app.use("/api/perfiles", perfilRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/perfilmenu", perfilMenuRoutes);
app.use("/api/usuarioperfil", usuarioPerfilRoutes);
app.use("/api/ventaproducto", ventaProductoRoutes);
app.use("/api/venta", ventaRoutes);
app.use("/api/ventacredito", ventaCreditoRoutes);
app.use("/api/ventacreditopago", ventaCreditoPagoRoutes);
app.use("/api/factura", facturaRoutes);
app.use("/api/compras", compraRoutes);
app.use("/api/proveedores", proveedorRoutes);
app.use("/api/cajagasto", cajagastoRoutes);
app.use("/api/cajatipo", cajatipoRoutes);
app.use("/api/transporte", transporteRoutes);
app.use("/api/pagotrans", pagotransRoutes);
app.use("/api/colegio", colegioRoutes);
app.use("/api/colegiocurso", colegiocursoRoutes);
app.use("/api/nomina", nominaRoutes);
app.use("/api/colegiocobranza", colegiocobranzaRoutes);
app.use("/api/divisa", divisaRoutes);
app.use("/api/divisagasto", divisaGastoRoutes);
app.use("/api/divisamovimiento", divisaMovimientoRoutes);
app.use("/api/jsicobro", jsicobroRoutes);
app.use("/api/horariouso", horarioUsoRoutes);
app.use("/api/pagoadmin", pagoAdminRoutes);
app.use("/api/westernenvio", westernEnvioRoutes);
// app.use("/api/productos", productoRoutes); // Ejemplo adicional

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API funcionando");
});

// Manejo de errores (puedes mejorarlo)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Algo salió mal!");
});

const PORT = process.env.PORT || 3013;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en puerto ${PORT}`);
});
