--
-- PostgreSQL database dump
--

\restrict hfJdxcI1Jj5l6R0Mlv2sANRcI9k4WQMlY6qTJpAatIg43TK6WU8CuOGqWhf1thn

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: EstadoSocio; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EstadoSocio" AS ENUM (
    'ACTIVO',
    'INACTIVO',
    'SUSPENDIDO'
);


ALTER TYPE public."EstadoSocio" OWNER TO postgres;

--
-- Name: EstadoUsuario; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EstadoUsuario" AS ENUM (
    'ACTIVO',
    'INACTIVO',
    'BLOQUEADO'
);


ALTER TYPE public."EstadoUsuario" OWNER TO postgres;

--
-- Name: RolUsuario; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RolUsuario" AS ENUM (
    'ADMIN',
    'SOCIO'
);


ALTER TYPE public."RolUsuario" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Auditoria" (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    accion text NOT NULL,
    entidad text NOT NULL,
    entidad_id integer,
    detalle text,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Auditoria" OWNER TO postgres;

--
-- Name: Auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Auditoria_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Auditoria_id_seq" OWNER TO postgres;

--
-- Name: Auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Auditoria_id_seq" OWNED BY public."Auditoria".id;


--
-- Name: Compra; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Compra" (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado text NOT NULL,
    observaciones text,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Compra" OWNER TO postgres;

--
-- Name: CompraDetalle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CompraDetalle" (
    id integer NOT NULL,
    compra_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad double precision NOT NULL
);


ALTER TABLE public."CompraDetalle" OWNER TO postgres;

--
-- Name: CompraDetalle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."CompraDetalle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CompraDetalle_id_seq" OWNER TO postgres;

--
-- Name: CompraDetalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."CompraDetalle_id_seq" OWNED BY public."CompraDetalle".id;


--
-- Name: Compra_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Compra_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Compra_id_seq" OWNER TO postgres;

--
-- Name: Compra_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Compra_id_seq" OWNED BY public."Compra".id;


--
-- Name: HistorialReserva; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HistorialReserva" (
    id integer NOT NULL,
    reserva_id integer NOT NULL,
    estado text NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    observaciones text
);


ALTER TABLE public."HistorialReserva" OWNER TO postgres;

--
-- Name: HistorialReserva_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HistorialReserva_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HistorialReserva_id_seq" OWNER TO postgres;

--
-- Name: HistorialReserva_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HistorialReserva_id_seq" OWNED BY public."HistorialReserva".id;


--
-- Name: MovimientoStock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MovimientoStock" (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo text NOT NULL,
    cantidad double precision NOT NULL,
    referencia_id integer,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MovimientoStock" OWNER TO postgres;

--
-- Name: MovimientoStock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."MovimientoStock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MovimientoStock_id_seq" OWNER TO postgres;

--
-- Name: MovimientoStock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."MovimientoStock_id_seq" OWNED BY public."MovimientoStock".id;


--
-- Name: Notificacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notificacion" (
    id integer NOT NULL,
    socio_id integer,
    tipo text NOT NULL,
    mensaje text NOT NULL,
    canal text NOT NULL,
    estado text NOT NULL,
    origen_id integer,
    fecha_envio timestamp(3) without time zone,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    origen_tipo text
);


ALTER TABLE public."Notificacion" OWNER TO postgres;

--
-- Name: Notificacion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Notificacion_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Notificacion_id_seq" OWNER TO postgres;

--
-- Name: Notificacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Notificacion_id_seq" OWNED BY public."Notificacion".id;


--
-- Name: Producto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Producto" (
    id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text NOT NULL,
    tipo text NOT NULL,
    unidad_medida text NOT NULL,
    precio_venta_actual double precision NOT NULL,
    estado text NOT NULL,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Producto" OWNER TO postgres;

--
-- Name: Producto_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Producto_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Producto_id_seq" OWNER TO postgres;

--
-- Name: Producto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Producto_id_seq" OWNED BY public."Producto".id;


--
-- Name: Proveedor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Proveedor" (
    id integer NOT NULL,
    nombre text NOT NULL,
    contacto text,
    telefono text,
    email text,
    estado text NOT NULL,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Proveedor" OWNER TO postgres;

--
-- Name: Proveedor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Proveedor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Proveedor_id_seq" OWNER TO postgres;

--
-- Name: Proveedor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Proveedor_id_seq" OWNED BY public."Proveedor".id;


--
-- Name: Reserva; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Reserva" (
    id integer NOT NULL,
    socio_id integer NOT NULL,
    usuario_id integer NOT NULL,
    fecha_solicitud timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_limite_retiro timestamp(3) without time zone NOT NULL,
    estado text NOT NULL,
    observaciones text,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Reserva" OWNER TO postgres;

--
-- Name: ReservaDetalle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ReservaDetalle" (
    id integer NOT NULL,
    reserva_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad double precision NOT NULL
);


ALTER TABLE public."ReservaDetalle" OWNER TO postgres;

--
-- Name: ReservaDetalle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ReservaDetalle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ReservaDetalle_id_seq" OWNER TO postgres;

--
-- Name: ReservaDetalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ReservaDetalle_id_seq" OWNED BY public."ReservaDetalle".id;


--
-- Name: Reserva_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Reserva_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Reserva_id_seq" OWNER TO postgres;

--
-- Name: Reserva_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Reserva_id_seq" OWNED BY public."Reserva".id;


--
-- Name: Socio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Socio" (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    documento text NOT NULL,
    nombre text NOT NULL,
    apellido text NOT NULL,
    telefono text NOT NULL,
    estado public."EstadoSocio" NOT NULL,
    fecha_alta timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    consentimiento_aceptado boolean DEFAULT false NOT NULL,
    fecha_consentimiento timestamp(3) without time zone,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Socio" OWNER TO postgres;

--
-- Name: Socio_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Socio_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Socio_id_seq" OWNER TO postgres;

--
-- Name: Socio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Socio_id_seq" OWNED BY public."Socio".id;


--
-- Name: Stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Stock" (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_total double precision NOT NULL,
    cantidad_reservada double precision DEFAULT 0 NOT NULL,
    cantidad_disponible double precision NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Stock" OWNER TO postgres;

--
-- Name: Stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Stock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Stock_id_seq" OWNER TO postgres;

--
-- Name: Stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Stock_id_seq" OWNED BY public."Stock".id;


--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Usuario" (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    estado public."EstadoUsuario" NOT NULL,
    intentos_fallidos integer DEFAULT 0 NOT NULL,
    bloqueado_hasta timestamp(3) without time zone,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL,
    rol public."RolUsuario" NOT NULL
);


ALTER TABLE public."Usuario" OWNER TO postgres;

--
-- Name: Usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Usuario_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Usuario_id_seq" OWNER TO postgres;

--
-- Name: Usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Usuario_id_seq" OWNED BY public."Usuario".id;


--
-- Name: Venta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Venta" (
    id integer NOT NULL,
    socio_id integer NOT NULL,
    usuario_id integer NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado text NOT NULL,
    observaciones text,
    fecha_creacion timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Venta" OWNER TO postgres;

--
-- Name: VentaDetalle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."VentaDetalle" (
    id integer NOT NULL,
    venta_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad double precision NOT NULL,
    precio_unitario double precision NOT NULL
);


ALTER TABLE public."VentaDetalle" OWNER TO postgres;

--
-- Name: VentaDetalle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."VentaDetalle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."VentaDetalle_id_seq" OWNER TO postgres;

--
-- Name: VentaDetalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."VentaDetalle_id_seq" OWNED BY public."VentaDetalle".id;


--
-- Name: Venta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Venta_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Venta_id_seq" OWNER TO postgres;

--
-- Name: Venta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Venta_id_seq" OWNED BY public."Venta".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Auditoria id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Auditoria" ALTER COLUMN id SET DEFAULT nextval('public."Auditoria_id_seq"'::regclass);


--
-- Name: Compra id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Compra" ALTER COLUMN id SET DEFAULT nextval('public."Compra_id_seq"'::regclass);


--
-- Name: CompraDetalle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompraDetalle" ALTER COLUMN id SET DEFAULT nextval('public."CompraDetalle_id_seq"'::regclass);


--
-- Name: HistorialReserva id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HistorialReserva" ALTER COLUMN id SET DEFAULT nextval('public."HistorialReserva_id_seq"'::regclass);


--
-- Name: MovimientoStock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MovimientoStock" ALTER COLUMN id SET DEFAULT nextval('public."MovimientoStock_id_seq"'::regclass);


--
-- Name: Notificacion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notificacion" ALTER COLUMN id SET DEFAULT nextval('public."Notificacion_id_seq"'::regclass);


--
-- Name: Producto id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Producto" ALTER COLUMN id SET DEFAULT nextval('public."Producto_id_seq"'::regclass);


--
-- Name: Proveedor id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Proveedor" ALTER COLUMN id SET DEFAULT nextval('public."Proveedor_id_seq"'::regclass);


--
-- Name: Reserva id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Reserva" ALTER COLUMN id SET DEFAULT nextval('public."Reserva_id_seq"'::regclass);


--
-- Name: ReservaDetalle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReservaDetalle" ALTER COLUMN id SET DEFAULT nextval('public."ReservaDetalle_id_seq"'::regclass);


--
-- Name: Socio id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Socio" ALTER COLUMN id SET DEFAULT nextval('public."Socio_id_seq"'::regclass);


--
-- Name: Stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Stock" ALTER COLUMN id SET DEFAULT nextval('public."Stock_id_seq"'::regclass);


--
-- Name: Usuario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Usuario" ALTER COLUMN id SET DEFAULT nextval('public."Usuario_id_seq"'::regclass);


--
-- Name: Venta id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venta" ALTER COLUMN id SET DEFAULT nextval('public."Venta_id_seq"'::regclass);


--
-- Name: VentaDetalle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VentaDetalle" ALTER COLUMN id SET DEFAULT nextval('public."VentaDetalle_id_seq"'::regclass);


--
-- Data for Name: Auditoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Auditoria" (id, usuario_id, accion, entidad, entidad_id, detalle, fecha_creacion) FROM stdin;
\.


--
-- Data for Name: Compra; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Compra" (id, proveedor_id, fecha, estado, observaciones, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- Data for Name: CompraDetalle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CompraDetalle" (id, compra_id, producto_id, cantidad) FROM stdin;
\.


--
-- Data for Name: HistorialReserva; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HistorialReserva" (id, reserva_id, estado, fecha, observaciones) FROM stdin;
\.


--
-- Data for Name: MovimientoStock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MovimientoStock" (id, producto_id, tipo, cantidad, referencia_id, fecha_creacion) FROM stdin;
\.


--
-- Data for Name: Notificacion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notificacion" (id, socio_id, tipo, mensaje, canal, estado, origen_id, fecha_envio, fecha_creacion, origen_tipo) FROM stdin;
\.


--
-- Data for Name: Producto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Producto" (id, nombre, descripcion, tipo, unidad_medida, precio_venta_actual, estado, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- Data for Name: Proveedor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Proveedor" (id, nombre, contacto, telefono, email, estado, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- Data for Name: Reserva; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Reserva" (id, socio_id, usuario_id, fecha_solicitud, fecha_limite_retiro, estado, observaciones, fecha_actualizacion) FROM stdin;
\.


--
-- Data for Name: ReservaDetalle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ReservaDetalle" (id, reserva_id, producto_id, cantidad) FROM stdin;
\.


--
-- Data for Name: Socio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Socio" (id, usuario_id, documento, nombre, apellido, telefono, estado, fecha_alta, consentimiento_aceptado, fecha_consentimiento, fecha_creacion, fecha_actualizacion) FROM stdin;
2	4	99999999	Pedro	Gomez	091111111	INACTIVO	2026-05-11 18:24:33.253	t	2026-05-11 18:24:33.248	2026-05-11 18:24:33.253	2026-05-11 18:45:58.158
3	5	77777777	Lucas	Martinez	092222222	INACTIVO	2026-05-11 18:53:50.626	t	2026-05-11 18:53:50.62	2026-05-11 18:53:50.626	2026-05-11 18:54:34.24
1	3	12345678	Juan Carlos	Pérez	099999999	INACTIVO	2026-05-11 18:01:24.36	t	2026-05-11 18:01:24.349	2026-05-11 18:01:24.36	2026-05-13 17:03:38.395
4	6	45678912	Socio	Consentimiento	099123456	ACTIVO	2026-05-14 17:04:35.432	t	2026-05-14 17:06:29.865	2026-05-14 17:04:35.432	2026-05-22 16:17:57.358
\.


--
-- Data for Name: Stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Stock" (id, producto_id, cantidad_total, cantidad_reservada, cantidad_disponible, fecha_actualizacion) FROM stdin;
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Usuario" (id, email, password_hash, estado, intentos_fallidos, bloqueado_hasta, fecha_creacion, fecha_actualizacion, rol) FROM stdin;
2	admin@test.com	$2b$10$nDt8f.7pvEJKfoD1xETqWu/VOOqaXR7dnzan1JlO3Q8nenA.CmCSK	ACTIVO	0	\N	2026-05-07 16:40:34.079	2026-05-07 16:40:34.079	ADMIN
4	otro@test.com	$2b$10$1TShmZZZfHjUNG2gk//Fs.kZ.hyRaFXJ9/JnBPFezKdP9ymiHaiLm	ACTIVO	0	\N	2026-05-11 18:24:33.246	2026-05-11 18:24:33.246	SOCIO
5	nuevo@test.com	$2b$10$9Xm0s9LkBKQ39PnkjnCn5OmpudC2GhHCNST3Bf67a5gf/ujTLwTde	INACTIVO	0	\N	2026-05-11 18:53:50.617	2026-05-11 18:54:34.244	SOCIO
3	socio@test.com	$2b$10$5ZD7T.9nOoi13r9ckQxT/.fSclzTLLpEE/y3DAT8iiGvcSt9my8Ru	INACTIVO	0	\N	2026-05-11 18:01:24.341	2026-05-13 17:03:38.374	SOCIO
6	socio.consentimiento@test.com	$2b$10$rFIHQh6pHlSx..A8TJuqZeYN0VsH7s3RO9TRWGNzGdjEuJDUKZLAK	ACTIVO	0	\N	2026-05-14 17:04:35.411	2026-05-22 16:17:57.357	SOCIO
\.


--
-- Data for Name: Venta; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Venta" (id, socio_id, usuario_id, fecha, estado, observaciones, fecha_creacion, fecha_actualizacion) FROM stdin;
\.


--
-- Data for Name: VentaDetalle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."VentaDetalle" (id, venta_id, producto_id, cantidad, precio_unitario) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
e968b6a1-272a-41c4-8e45-86f0df55288a	b6919d636fa4775340dda9c75a702c3a6285547a5b2e8cc6f583423899e39be9	2026-05-05 11:30:35.790368-03	20260505143035_init	\N	\N	2026-05-05 11:30:35.710346-03	1
05895850-b2b6-44ac-bcaa-a558f3816e3c	327fcb9293ea1fda7c60bacdbbfba865545bd17d328995c6c34387c4a2d16dc6	2026-05-07 16:14:28.855332-03	20260507191428_add_user_roles_enum	\N	\N	2026-05-07 16:14:28.817299-03	1
3d3398b0-4323-4f8a-9187-9f301675c2b3	95696ebe8c696ba325b8c37be6172cbdf3d63804bc7495cc4676152154116627	2026-05-11 14:50:56.026323-03	20260511175055_add_unique_documento_socio	\N	\N	2026-05-11 14:50:55.986468-03	1
8d3feafc-03a8-4950-9b84-e9e7af614f3d	a24a9f96020c88a5a00223d77c492326e86f59dc102c9e1505a9adda616a5d9a	2026-05-21 11:47:19.537624-03	20260521144719_add_historial_reserva	\N	\N	2026-05-21 11:47:19.441486-03	1
e1fe4864-b016-45b9-94b3-e604bad165d6	fa0db4adfc21631ce72028ec544decadf21717bf11a299f0ded416d1261e515f	2026-05-21 12:00:54.435563-03	20260521150054_add_auditoria	\N	\N	2026-05-21 12:00:54.403759-03	1
644af578-7e88-4524-9ee7-1f0fc4d2d8c3	0b2124088d69fc11c83eda130db09c524916a853563cbef089aff13e6f3ece4f	2026-05-21 12:19:59.606881-03	20260521151959_add_origen_tipo_notificacion	\N	\N	2026-05-21 12:19:59.603471-03	1
ac3a7801-1e44-4c23-a4ae-e9ad624817c1	a60390ede23cc58218cf83f6e2efbf862677760f7defc638372230d76912c03b	2026-05-21 14:15:12.954806-03	20260521170025_normalize_status_enums		\N	2026-05-21 14:15:12.954806-03	0
\.


--
-- Name: Auditoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Auditoria_id_seq"', 1, false);


--
-- Name: CompraDetalle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."CompraDetalle_id_seq"', 1, false);


--
-- Name: Compra_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Compra_id_seq"', 1, false);


--
-- Name: HistorialReserva_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HistorialReserva_id_seq"', 1, false);


--
-- Name: MovimientoStock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."MovimientoStock_id_seq"', 1, false);


--
-- Name: Notificacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Notificacion_id_seq"', 1, false);


--
-- Name: Producto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Producto_id_seq"', 1, false);


--
-- Name: Proveedor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Proveedor_id_seq"', 1, false);


--
-- Name: ReservaDetalle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ReservaDetalle_id_seq"', 1, false);


--
-- Name: Reserva_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Reserva_id_seq"', 1, false);


--
-- Name: Socio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Socio_id_seq"', 4, true);


--
-- Name: Stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Stock_id_seq"', 1, false);


--
-- Name: Usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Usuario_id_seq"', 6, true);


--
-- Name: VentaDetalle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."VentaDetalle_id_seq"', 1, false);


--
-- Name: Venta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Venta_id_seq"', 1, false);


--
-- Name: Auditoria Auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_pkey" PRIMARY KEY (id);


--
-- Name: CompraDetalle CompraDetalle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompraDetalle"
    ADD CONSTRAINT "CompraDetalle_pkey" PRIMARY KEY (id);


--
-- Name: Compra Compra_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_pkey" PRIMARY KEY (id);


--
-- Name: HistorialReserva HistorialReserva_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HistorialReserva"
    ADD CONSTRAINT "HistorialReserva_pkey" PRIMARY KEY (id);


--
-- Name: MovimientoStock MovimientoStock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MovimientoStock"
    ADD CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY (id);


--
-- Name: Notificacion Notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notificacion"
    ADD CONSTRAINT "Notificacion_pkey" PRIMARY KEY (id);


--
-- Name: Producto Producto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_pkey" PRIMARY KEY (id);


--
-- Name: Proveedor Proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Proveedor"
    ADD CONSTRAINT "Proveedor_pkey" PRIMARY KEY (id);


--
-- Name: ReservaDetalle ReservaDetalle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReservaDetalle"
    ADD CONSTRAINT "ReservaDetalle_pkey" PRIMARY KEY (id);


--
-- Name: Reserva Reserva_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Reserva"
    ADD CONSTRAINT "Reserva_pkey" PRIMARY KEY (id);


--
-- Name: Socio Socio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Socio"
    ADD CONSTRAINT "Socio_pkey" PRIMARY KEY (id);


--
-- Name: Stock Stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Stock"
    ADD CONSTRAINT "Stock_pkey" PRIMARY KEY (id);


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: VentaDetalle VentaDetalle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VentaDetalle"
    ADD CONSTRAINT "VentaDetalle_pkey" PRIMARY KEY (id);


--
-- Name: Venta Venta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venta"
    ADD CONSTRAINT "Venta_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Socio_documento_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Socio_documento_key" ON public."Socio" USING btree (documento);


--
-- Name: Socio_usuario_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Socio_usuario_id_key" ON public."Socio" USING btree (usuario_id);


--
-- Name: Stock_producto_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Stock_producto_id_key" ON public."Stock" USING btree (producto_id);


--
-- Name: Usuario_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- Name: Auditoria Auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CompraDetalle CompraDetalle_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompraDetalle"
    ADD CONSTRAINT "CompraDetalle_compra_id_fkey" FOREIGN KEY (compra_id) REFERENCES public."Compra"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CompraDetalle CompraDetalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompraDetalle"
    ADD CONSTRAINT "CompraDetalle_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Compra Compra_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HistorialReserva HistorialReserva_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HistorialReserva"
    ADD CONSTRAINT "HistorialReserva_reserva_id_fkey" FOREIGN KEY (reserva_id) REFERENCES public."Reserva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoStock MovimientoStock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MovimientoStock"
    ADD CONSTRAINT "MovimientoStock_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notificacion Notificacion_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notificacion"
    ADD CONSTRAINT "Notificacion_socio_id_fkey" FOREIGN KEY (socio_id) REFERENCES public."Socio"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReservaDetalle ReservaDetalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReservaDetalle"
    ADD CONSTRAINT "ReservaDetalle_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ReservaDetalle ReservaDetalle_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReservaDetalle"
    ADD CONSTRAINT "ReservaDetalle_reserva_id_fkey" FOREIGN KEY (reserva_id) REFERENCES public."Reserva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Reserva Reserva_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Reserva"
    ADD CONSTRAINT "Reserva_socio_id_fkey" FOREIGN KEY (socio_id) REFERENCES public."Socio"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Reserva Reserva_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Reserva"
    ADD CONSTRAINT "Reserva_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Socio Socio_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Socio"
    ADD CONSTRAINT "Socio_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Stock Stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Stock"
    ADD CONSTRAINT "Stock_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VentaDetalle VentaDetalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VentaDetalle"
    ADD CONSTRAINT "VentaDetalle_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VentaDetalle VentaDetalle_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."VentaDetalle"
    ADD CONSTRAINT "VentaDetalle_venta_id_fkey" FOREIGN KEY (venta_id) REFERENCES public."Venta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Venta Venta_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venta"
    ADD CONSTRAINT "Venta_socio_id_fkey" FOREIGN KEY (socio_id) REFERENCES public."Socio"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Venta Venta_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venta"
    ADD CONSTRAINT "Venta_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict hfJdxcI1Jj5l6R0Mlv2sANRcI9k4WQMlY6qTJpAatIg43TK6WU8CuOGqWhf1thn

