import { GoogleGenAI } from "@google/genai";

/* =========================================================
   CONFIGURACIÓN DEL PROVEEDOR
========================================================= */

// Modelo por defecto elegido para una tarea breve y estructurada.
// Puede cambiarse desde el entorno sin modificar el código fuente.
const MODELO_POR_DEFECTO = "gemini-3.5-flash-lite";

// Tiempo máximo que esperamos por una respuesta del proveedor externo.
// Evita que una llamada a Gemini deje bloqueada la petición del Dashboard.
const TIMEOUT_POR_DEFECTO_MS = 15_000;

// El Dashboard nunca envía más de cinco productos a la IA.
const LIMITE_CANDIDATOS = 5;

// Valores que el modelo puede devolver para priorizar recomendaciones.
const PRIORIDADES_VALIDAS = ["ALTA", "MEDIA", "BAJA"];

// El cliente se crea de forma diferida, únicamente cuando se solicita
// una recomendación. De esta manera, una configuración faltante de IA
// no impide que el resto del backend ni el Dashboard operativo inicien.
let clienteGemini = null;

/* =========================================================
   CONTRATO DE RESPUESTA DE GEMINI
========================================================= */

// Gemini recibe este JSON Schema mediante "structured output".
// El esquema obliga al modelo a devolver JSON con una estructura predecible,
// en lugar de texto libre difícil de procesar de forma segura.
const ESQUEMA_RESPUESTA = {
  type: "object",
  properties: {
    recomendaciones: {
      type: "array",
      description:
        "Recomendaciones generadas únicamente para los productos recibidos.",
      items: {
        type: "object",
        properties: {
          productoId: {
            type: "integer",
            description:
              "Identificador exacto del producto recibido en la entrada.",
          },
          prioridad: {
            type: "string",
            enum: PRIORIDADES_VALIDAS,
            description:
              "Nivel de urgencia relativo: ALTA, MEDIA o BAJA.",
          },
          justificacion: {
            type: "string",
            description:
              "Explicación breve en español basada solo en los datos recibidos.",
          },
        },
        required: ["productoId", "prioridad", "justificacion"],
      },
    },
  },
  required: ["recomendaciones"],
};

/* =========================================================
   INSTRUCCIONES PARA EL MODELO
========================================================= */

// Esta instrucción define con precisión el rol de la IA.
// La IA NO calcula cantidades ni modifica datos: el backend ya realizó
// esos cálculos. Gemini solamente prioriza y explica los resultados.
const INSTRUCCION_SISTEMA = `
Actuás como asistente de apoyo a la gestión de stock de un club cannábico uruguayo.

Tu única tarea es priorizar y explicar recomendaciones ya calculadas por el backend.

Reglas obligatorias:
1. Generá exactamente una recomendación por cada producto recibido.
2. Conservá exactamente el productoId recibido.
3. No recalcules ni modifiques cantidadSugerida.
4. No inventes productos, cantidades, ventas, reservas ni stock.
5. Usá únicamente los datos agregados incluidos en la entrada.
6. Asigná prioridad ALTA, MEDIA o BAJA comparando la urgencia entre los candidatos.
7. Considerá más urgente un producto sin stock disponible o con mayor déficit respecto de su demanda reciente.
8. Redactá la justificación en español, en una o dos oraciones breves.
9. No incluyas datos personales, consejos médicos, consejos legales ni instrucciones de compra.
10. No uses Markdown ni agregues campos diferentes a los definidos por el esquema.
`;

/* =========================================================
   HELPERS DE CONFIGURACIÓN
========================================================= */

const obtenerEnteroPositivo = (valor, valorPorDefecto) => {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0
    ? numero
    : valorPorDefecto;
};

const obtenerConfiguracion = () => {
  const apiKey = String(process.env.GEMINI_API_KEY ?? "").trim();

  if (!apiKey) {
    const error = new Error(
      "La integración con Gemini no está configurada",
    );
    error.name = "GeminiConfigurationError";
    error.code = "GEMINI_API_KEY_MISSING";
    throw error;
  }

  return {
    apiKey,
    modelo:
      String(process.env.GEMINI_MODEL ?? "").trim() ||
      MODELO_POR_DEFECTO,
    timeoutMs: obtenerEnteroPositivo(
      process.env.GEMINI_TIMEOUT_MS,
      TIMEOUT_POR_DEFECTO_MS,
    ),
  };
};

const obtenerClienteGemini = () => {
  if (clienteGemini) {
    return clienteGemini;
  }

  const { apiKey, timeoutMs } = obtenerConfiguracion();

  clienteGemini = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: timeoutMs,

      // Solo se reintentan errores transitorios. No se reintentan errores
      // de autenticación o solicitudes inválidas porque repetirlos no ayuda.
      retryOptions: {
        attempts: 3,
        initialDelay: 1,
        expBase: 2,
        maxDelay: 4,
        jitter: 0.25,
        httpStatusCodes: [408, 429, 500, 502, 503, 504],
      },
    },
  });

  return clienteGemini;
};

/* =========================================================
   PREPARACIÓN SEGURA DE LOS DATOS
========================================================= */

const normalizarNumero = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    throw new TypeError(
      "Los candidatos de recomendación contienen datos numéricos inválidos",
    );
  }

  return Number(numero.toFixed(2));
};

const prepararCandidatos = (candidatos) => {
  if (!Array.isArray(candidatos)) {
    throw new TypeError(
      "Los candidatos de recomendación deben enviarse como un arreglo",
    );
  }

  return candidatos.slice(0, LIMITE_CANDIDATOS).map((candidato) => {
    const productoId = Number(candidato?.productoId);
    const producto = String(candidato?.producto ?? "").trim();

    if (!Number.isInteger(productoId) || productoId <= 0 || !producto) {
      throw new TypeError(
        "Los candidatos de recomendación contienen un producto inválido",
      );
    }

    // Se construye un objeto nuevo con una lista cerrada de propiedades.
    // Así evitamos enviar accidentalmente datos adicionales o personales
    // que pudieran venir incorporados en el objeto original.
    return {
      productoId,
      producto,
      gramosVendidos30Dias: normalizarNumero(
        candidato.gramosVendidos30Dias,
      ),
      gramosReservados: normalizarNumero(
        candidato.gramosReservados,
      ),
      stockDisponible: normalizarNumero(
        candidato.stockDisponible,
      ),
      cantidadSugerida: normalizarNumero(
        candidato.cantidadSugerida,
      ),
    };
  });
};

const construirEntrada = (candidatos) => `
Analizá los siguientes candidatos de reposición.

La cantidad sugerida ya fue calculada y validada por el backend.
No la modifiques ni realices cálculos alternativos.

Candidatos:
${JSON.stringify(candidatos, null, 2)}
`;

/* =========================================================
   PROCESAMIENTO DE LA RESPUESTA
========================================================= */

const parsearRespuesta = (textoRespuesta, cantidadEsperada) => {
  const texto = String(textoRespuesta ?? "").trim();

  if (!texto) {
    throw new Error("Gemini devolvió una respuesta vacía");
  }

  let respuesta;

  try {
    respuesta = JSON.parse(texto);
  } catch {
    throw new Error("Gemini devolvió un JSON que no pudo interpretarse");
  }

  if (
    !respuesta ||
    !Array.isArray(respuesta.recomendaciones) ||
    respuesta.recomendaciones.length !== cantidadEsperada
  ) {
    throw new Error(
      "Gemini devolvió una cantidad inesperada de recomendaciones",
    );
  }

  // La validación de negocio definitiva se realiza después en
  // dashboardService.js. Este proveedor solo valida el contrato externo.
  return respuesta.recomendaciones;
};

const normalizarErrorProveedor = (error) => {
  const errorNormalizado = new Error(
    "No fue posible obtener una respuesta válida de Gemini",
  );

  errorNormalizado.name = "GeminiProviderError";
  errorNormalizado.code =
    error?.code || error?.name || "GEMINI_PROVIDER_ERROR";
  errorNormalizado.status = Number.isInteger(Number(error?.status))
    ? Number(error.status)
    : null;

  return errorNormalizado;
};

/* =========================================================
   OPERACIÓN PÚBLICA DEL ADAPTADOR
========================================================= */

// Esta es la única función que conoce dashboardService.js.
// Recibe métricas agregadas, llama al proveedor externo y devuelve
// únicamente prioridad y justificación asociadas a cada producto.
export const generarRecomendacionesStockConIA = async (candidatos) => {
  const candidatosPreparados = prepararCandidatos(candidatos);

  // Evita consumir la API cuando no existe ningún producto para analizar.
  if (candidatosPreparados.length === 0) {
    return [];
  }

  try {
    const cliente = obtenerClienteGemini();
    const { modelo } = obtenerConfiguracion();

    const interaccion = await cliente.interactions.create({
      model: modelo,

      // Desactiva el almacenamiento de la interacción en el servidor.
      // La petición es independiente y no necesita historial conversacional.
      store: false,

      system_instruction: INSTRUCCION_SISTEMA,
      input: construirEntrada(candidatosPreparados),

      // Solicita una salida JSON ajustada al contrato definido arriba.
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: ESQUEMA_RESPUESTA,
      },
    });

    return parsearRespuesta(
      interaccion.output_text,
      candidatosPreparados.length,
    );
  } catch (error) {
    // Los errores propios de configuración se conservan para facilitar
    // el diagnóstico sin exponer la API key ni la respuesta completa.
    if (error?.name === "GeminiConfigurationError") {
      throw error;
    }

    throw normalizarErrorProveedor(error);
  }
};
