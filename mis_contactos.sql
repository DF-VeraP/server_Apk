--
-- PostgreSQL database dump
--

\restrict e3wBR7XKc07RhhphwhaUaRV0Z9GIdEO78Q8z1CQh7s2VehfPH9oTt9YaGFfZpC7

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2026-07-01 21:40:46

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 53688)
-- Name: contactos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contactos (
    cc character varying(20) NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    contacto character varying(15) NOT NULL,
    direccion text,
    fecha_nacimiento date,
    profesion character varying(100),
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.contactos OWNER TO postgres;

--
-- TOC entry 4843 (class 0 OID 53688)
-- Dependencies: 217
-- Data for Name: contactos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contactos (cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, fecha_creacion, fecha_actualizacion) FROM stdin;
1004110014	Tatiana	Ramos	300200102	\N	\N	\N	2026-07-01 19:27:55.333439	2026-07-01 20:07:46.052556
\.


--
-- TOC entry 4697 (class 2606 OID 53696)
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (cc);


-- Completed on 2026-07-01 21:40:46

--
-- PostgreSQL database dump complete
--

\unrestrict e3wBR7XKc07RhhphwhaUaRV0Z9GIdEO78Q8z1CQh7s2VehfPH9oTt9YaGFfZpC7

