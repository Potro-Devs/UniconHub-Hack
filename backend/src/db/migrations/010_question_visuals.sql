-- Gráfico del reactivo como datos, no como imagen (plan de acción fase 2, punto 4.3).
-- En 1.º a 3.º el dibujo es parte de la pregunta: sin él, un alumno que sí reconoce 1/3 en una barra
-- puede quedar como "Necesita apoyo". Formato (JSON): { "type": "fraction_bar", "parts": 4, "shaded": 1 }.
-- NULL = el reactivo no lleva gráfico. (009 queda reservada para Osvaldo.)
ALTER TABLE questions ADD COLUMN visual TEXT;
