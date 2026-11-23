/**
 * Textos y reactivos de comprensión lectora (uno por grado, 4 reactivos cada uno).
 * Cada distractor se etiqueta con un error típico de lectura.
 */

export const READING_ERROR_EXPLANATIONS = Object.freeze({
  detail_as_main_idea: 'Elige un detalle del texto en lugar de la idea principal.',
  off_topic: 'Elige algo que el texto no menciona.',
  confuses_characters: 'Confunde a los personajes del texto.',
  literal_misread: 'Lee la información del texto de forma inexacta.',
  unsupported_inference: 'Saca una conclusión que el texto no permite.',
  prior_knowledge_over_text: 'Responde con lo que ya sabe en lugar de con lo que dice el texto.',
  context_vocabulary: 'No usa la oración para descubrir el significado de la palabra.',
});

/** Pistas por tipo de pregunta. Ninguna menciona la respuesta del reactivo. */
export const READING_HINTS = Object.freeze({
  main: [
    'Lee otra vez todo el texto y piensa: ¿de qué habla casi todo el tiempo?',
    'Descarta las opciones que solo hablan de una parte pequeña del texto o de algo que no dice.',
    'Ejemplo parecido: si un texto explica cómo cuidar a un perro, su idea principal es cuidar al perro, no el color de su collar.',
  ],
  detail: [
    'Busca en el texto la palabra más importante de la pregunta.',
    'Lee con calma la oración donde aparece esa palabra; ahí está la información que necesitas.',
    'Ejemplo parecido: si la pregunta es «¿qué come el conejo?», busca la palabra «come» en el texto.',
  ],
  inference: [
    'La respuesta no está escrita tal cual: piensa en lo que el texto sí cuenta.',
    'Elige la opción que puedes explicar con algo que dice el texto, no con lo que tú imaginas.',
    'Ejemplo parecido: si el texto dice que Ana tomó su paraguas al salir, podemos pensar que estaba lloviendo.',
  ],
  vocabulary: [
    'Busca la palabra en el texto y lee la oración completa.',
    'Cambia la palabra por cada opción: ¿cuál conserva el sentido de la oración?',
    'Ejemplo parecido: en «la niña se asomó por la ventana», asomarse es mostrar un poco la cabeza.',
  ],
});

export const READING_TEXTS = Object.freeze([
  {
    grade: 1,
    title: 'El gato Nube',
    text: 'Lupita tiene un gato gris que se llama Nube. A Nube le gusta dormir al sol en la ventana. Cuando llueve, Nube se esconde debajo de la cama.',
    questions: [
      { type: 'main', q: '¿De quién habla el texto?', correct: 'Del gato de Lupita',
        distractors: [['De la lluvia', 'detail_as_main_idea'], ['De una ventana', 'detail_as_main_idea'], ['De un perro', 'off_topic']] },
      { type: 'detail', q: '¿Cómo se llama el gato?', correct: 'Nube',
        distractors: [['Lupita', 'confuses_characters'], ['Gris', 'literal_misread'], ['Sol', 'literal_misread']] },
      { type: 'inference', q: '¿Qué hace Nube un día de tormenta?', correct: 'Se esconde debajo de la cama',
        distractors: [['Duerme al sol en la ventana', 'literal_misread'], ['Sale a jugar al patio', 'unsupported_inference'], ['Busca a otros gatos', 'unsupported_inference']] },
      { type: 'vocabulary', q: 'En el texto, ¿qué quiere decir «se esconde»?', correct: 'Se pone donde no lo ven',
        distractors: [['Se duerme', 'context_vocabulary'], ['Se moja', 'context_vocabulary'], ['Se enoja', 'context_vocabulary']] },
    ],
  },
  {
    grade: 2,
    title: 'La huerta de la escuela',
    text: 'En la escuela de Tomás hay una huerta. Los alumnos de segundo sembraron rábanos. Todos los lunes riegan las plantas y quitan la hierba mala. En diciembre, los rábanos estaban listos y los compartieron en el recreo.',
    questions: [
      { type: 'main', q: '¿De qué trata principalmente el texto?', correct: 'De cómo los alumnos cuidan la huerta de la escuela',
        distractors: [['Del recreo de diciembre', 'detail_as_main_idea'], ['De la hierba mala', 'detail_as_main_idea'], ['De cómo se cocinan los rábanos', 'off_topic']] },
      { type: 'detail', q: '¿Qué sembraron los alumnos de segundo?', correct: 'Rábanos',
        distractors: [['Hierba', 'literal_misread'], ['Lechugas', 'off_topic'], ['Flores', 'prior_knowledge_over_text']] },
      { type: 'detail', q: '¿Qué día riegan las plantas?', correct: 'Los lunes',
        distractors: [['En diciembre', 'literal_misread'], ['Todos los días', 'unsupported_inference'], ['En el recreo', 'literal_misread']] },
      { type: 'inference', q: '¿Por qué compartieron los rábanos en diciembre?', correct: 'Porque ya estaban listos',
        distractors: [['Porque era la hora del recreo', 'literal_misread'], ['Porque no les gustaban', 'unsupported_inference'], ['Porque se iban a echar a perder', 'unsupported_inference']] },
    ],
  },
  {
    grade: 3,
    title: 'Los ajolotes',
    text: 'El ajolote es un anfibio que vive en los canales de Xochimilco, en la Ciudad de México. Puede regenerar partes de su cuerpo, como las patas o la cola. Hoy está en peligro porque el agua de los canales está contaminada. Por eso, varios grupos de personas limpian los canales y cuidan su hábitat.',
    questions: [
      { type: 'main', q: '¿Cuál es la idea principal del texto?', correct: 'El ajolote es un animal especial que hoy está en peligro',
        distractors: [['Xochimilco está en la Ciudad de México', 'detail_as_main_idea'], ['El ajolote puede regenerar su cola', 'detail_as_main_idea'], ['Los ajolotes son peces de colores', 'prior_knowledge_over_text']] },
      { type: 'detail', q: '¿Dónde vive el ajolote?', correct: 'En los canales de Xochimilco',
        distractors: [['En el mar', 'prior_knowledge_over_text'], ['En los ríos del desierto', 'off_topic'], ['En cualquier ciudad', 'literal_misread']] },
      { type: 'inference', q: '¿Qué pasaría si los canales siguieran contaminados?', correct: 'Habría cada vez menos ajolotes',
        distractors: [['Los ajolotes limpiarían el agua', 'unsupported_inference'], ['Los ajolotes se irían al mar', 'unsupported_inference'], ['Nada, porque el ajolote regenera su cuerpo', 'literal_misread']] },
      { type: 'vocabulary', q: 'En el texto, ¿qué significa «hábitat»?', correct: 'El lugar donde vive un animal',
        distractors: [['La comida de un animal', 'context_vocabulary'], ['Una enfermedad del agua', 'context_vocabulary'], ['Un tipo de anfibio', 'context_vocabulary']] },
    ],
  },
  {
    grade: 4,
    title: 'La milpa',
    text: 'La milpa es una forma de cultivo que se usa en México desde hace miles de años. En un mismo terreno se siembran maíz, frijol y calabaza. El maíz sirve de apoyo para que el frijol trepe; el frijol aporta nutrientes al suelo, y las hojas grandes de la calabaza dan sombra y conservan la humedad. Así, cada planta ayuda a las otras a crecer.',
    questions: [
      { type: 'main', q: '¿Cuál es la idea principal del texto?', correct: 'En la milpa varias plantas se siembran juntas y se ayudan entre sí',
        distractors: [['La calabaza tiene hojas grandes', 'detail_as_main_idea'], ['El maíz es la planta más importante de México', 'unsupported_inference'], ['En México se come mucho maíz', 'prior_knowledge_over_text']] },
      { type: 'detail', q: '¿Para qué sirven las hojas de la calabaza?', correct: 'Para dar sombra y conservar la humedad',
        distractors: [['Para que el frijol trepe', 'literal_misread'], ['Para aportar nutrientes al suelo', 'literal_misread'], ['Para alimentar a los animales', 'off_topic']] },
      { type: 'inference', q: '¿Por qué la milpa se ha usado durante miles de años?', correct: 'Porque las plantas crecen mejor juntas',
        distractors: [['Porque solo se necesita una semilla', 'unsupported_inference'], ['Porque la calabaza crece sola', 'unsupported_inference'], ['Porque el frijol no necesita suelo', 'literal_misread']] },
      { type: 'vocabulary', q: '«El maíz sirve de apoyo para que el frijol trepe». ¿Qué significa «trepe»?', correct: 'Suba agarrándose',
        distractors: [['Se seque', 'context_vocabulary'], ['Florezca', 'context_vocabulary'], ['Se esconda', 'context_vocabulary']] },
    ],
  },
  {
    grade: 5,
    title: 'El reciclaje del papel',
    text: 'Para fabricar papel nuevo se cortan árboles y se usa mucha agua. Cuando reciclamos, el papel usado se mezcla con agua hasta formar una pasta; después se limpia, se prensa y se seca para obtener hojas nuevas. Reciclar una tonelada de papel evita que se corten alrededor de 17 árboles. Sin embargo, el papel no se puede reciclar para siempre: sus fibras se acortan cada vez y, después de unas siete veces, ya no sirven.',
    questions: [
      { type: 'main', q: '¿Cuál es la idea principal del texto?', correct: 'Reciclar papel ayuda a cuidar los árboles, aunque tiene límites',
        distractors: [['El papel usado se mezcla con agua', 'detail_as_main_idea'], ['Una tonelada de papel equivale a 17 árboles', 'detail_as_main_idea'], ['El papel reciclado es de mejor calidad', 'unsupported_inference']] },
      { type: 'detail', q: '¿Cuántas veces, aproximadamente, se puede reciclar el papel?', correct: 'Unas siete veces',
        distractors: [['Unas 17 veces', 'literal_misread'], ['Para siempre', 'literal_misread'], ['Una sola vez', 'unsupported_inference']] },
      { type: 'inference', q: 'Según el texto, ¿por qué reciclar no es suficiente?', correct: 'Porque las fibras se gastan y siempre hará falta algo de papel nuevo',
        distractors: [['Porque reciclar usa más árboles', 'literal_misread'], ['Porque el papel reciclado no se puede secar', 'unsupported_inference'], ['Porque casi nadie recicla', 'prior_knowledge_over_text']] },
      { type: 'vocabulary', q: '«...se forma una pasta; después se limpia, se prensa y se seca». ¿Qué significa «se prensa»?', correct: 'Se aplasta con fuerza',
        distractors: [['Se pinta', 'context_vocabulary'], ['Se calienta', 'context_vocabulary'], ['Se corta', 'context_vocabulary']] },
    ],
  },
  {
    grade: 6,
    title: 'Las abejas y la polinización',
    text: 'Muchas personas creen que las abejas solo sirven para producir miel, pero su trabajo más importante es la polinización. Al volar de flor en flor, llevan polen que permite que las plantas formen frutos y semillas. Una gran parte de los alimentos que comemos depende de los polinizadores. En los últimos años, el uso de pesticidas y la pérdida de flores silvestres han reducido el número de abejas, lo que preocupa a los agricultores.',
    questions: [
      { type: 'main', q: '¿Cuál es la idea principal del texto?', correct: 'La polinización de las abejas es clave para los alimentos y hoy está amenazada',
        distractors: [['Las abejas producen miel', 'prior_knowledge_over_text'], ['Los agricultores usan pesticidas', 'detail_as_main_idea'], ['Las flores silvestres son muy bonitas', 'off_topic']] },
      { type: 'detail', q: '¿Qué ha reducido el número de abejas?', correct: 'Los pesticidas y la pérdida de flores silvestres',
        distractors: [['La producción de miel', 'literal_misread'], ['La preocupación de los agricultores', 'literal_misread'], ['El frío del invierno', 'prior_knowledge_over_text']] },
      { type: 'inference', q: '¿Por qué les preocupa a los agricultores que haya menos abejas?', correct: 'Porque sus cultivos darían menos frutos',
        distractors: [['Porque venderían menos miel', 'prior_knowledge_over_text'], ['Porque las abejas se comen sus semillas', 'unsupported_inference'], ['Porque tendrían que usar más pesticidas', 'unsupported_inference']] },
      { type: 'vocabulary', q: 'En el texto, ¿qué son los «polinizadores»?', correct: 'Animales que llevan polen de una flor a otra',
        distractors: [['Personas que siembran flores', 'context_vocabulary'], ['Productos para eliminar insectos', 'context_vocabulary'], ['Plantas que producen miel', 'context_vocabulary']] },
    ],
  },
]);
