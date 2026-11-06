# EVÓ r90 · Tira semanal y «Tu día»

Basada en r89.

Cambios:
- Encabezado: los selectores de semana y día se reemplazan por una tira L–D con flechas de semana. Cada día muestra un punto: verde = día cerrado, terracota = con registros pendientes de cerrar, vacío = sin registro. Un toque elige el día.
- Hoy: nueva tarjeta «Tu día» con los pendientes (comidas, peso, entreno o cardio, Whoop, pasos y cerrar día), cada uno con su botón para registrar. Los retos siguen en Progreso → Retos y en Entreno.
- Textos pequeños más grandes y con más contraste (lema del logo, macros, textos grises).

Datos: no cambian claves de almacenamiento ni IDs.

# EVÓ r89 · Paleta «Tulum día»

- Colores cálidos tipo Tulum/wellness: fondo arena, terracota como color principal, salvia para lo completado y café espresso para el texto. Todos los colores del CSS pasan por variables en `:root`, así que la paleta se puede ajustar en un solo lugar.
- Gráficas y colores de los retos adaptados a la paleta (terracota, salvia, laguna, ocre, mostaza, ciruela, arcilla).
- Sin cambios de datos.

# EVÓ (antes FitTrack) r88 · Marca nueva y macros por alimento

- Nuevo nombre e identidad: EVÓ · Entrenamiento | Nutrición | Progreso (logo, iconos y nombre de la app instalada).

Basada en r87.

Cambios:
- Cada alimento guarda proteína, carbohidratos, grasas y fibra (g por porción base). Se muestran en Alimentos y se pueden editar; todavía no se suman al consumo.
- 72 alimentos nuevos de la lista «Despensa Tica» (marcas de Costa Rica). Los 28 que ya existían no se duplicaron: se conservaron con sus calorías y recibieron los macros de la lista.
- Origen de los macros: «etiqueta» (tabla nutricional del producto) o «aprox.» (estimación USDA FoodData Central o referencia genérica). Revisa la etiqueta del producto que compras.
- Súper: al cambiar cocinado ↔ crudo/seco, la existencia se redondea a un decimal.

Datos: no cambian claves de almacenamiento ni IDs existentes.

# FitTrack r87 · Registro rápido, recetas y despensa

Basada en r86. Subir el contenido del ZIP a la raíz de FITTRACK en GitHub Pages.

Cambios:
- Encabezado de Entreno más compacto; fotos ampliables y Copiar S1 a series pendientes.
- Hoy/Ayer y fecha junto a los controles de registro de comidas y formularios diarios.
- Recetas: buscador sin tildes, favoritos persistentes, recientes, variantes de nombres repetidos e ingredientes detallados.
- Ajustar porción a 500 kcal desde el editor; los registros consumidos conservan sus calorías.
- Súper: existencias crudas/secas o cocinadas; cambio de modo convierte las existencias sin alterarlas. Equivalencias aproximadas.
- Inicio guiado y acceso a restaurar; acceso a copias desde Opciones y fecha de la última descarga solicitada (el navegador no confirma que el archivo se haya conservado).
- Texto de equivalencia energética aclarado como estimación matemática.

Datos: no se borran recetas ni alimentos, no cambian IDs ni claves de almacenamiento. Favoritos y estado de despensa se incluyen en las copias del programa. Fotos originales sin cambios.

Validación: sintaxis de todos los JS; exportación conserva los registros y añade fecha; pruebas en Chromium de configuración, Hoy/Ayer, búsqueda, favoritos, recientes, conversión de existencias, ampliación de fotos, copia S1 y respeto de series completadas, ajuste de receta a 500 kcal. Datos ficticios en vista previa independiente. No se importó una copia privada ni se probó en un teléfono físico.


## r92
- Nutrientes diarios en Hoy y Comida → Registro; los totales incompletos se marcan parciales.
- Editar y duplicar comidas con fecha, tiempo de comida y multiplicador de porción (0,5 = mitad). Conserva los nutrientes originales.
- Flecha para deshacer la última edición o duplicado durante la sesión, siempre que no haya cambios posteriores en los días afectados.
- Peso: puntos reales, promedio de pesajes disponibles en siete días (mínimo dos), huecos sin registro y tabla semanal con número de pesajes.
- Aviso de copia tras tres días con cambios desde la última descarga solicitada. Comprobar el archivo en Descargas; el navegador no permite confirmar que se conservó.
- Antes de sustituir los archivos en GitHub, exportar los registros. Subir el contenido del ZIP a la carpeta que sirve GitHub Pages. Esta actualización no publica automáticamente.

## r93
- Gráfica de peso renovada: se dibuja al ancho real (números a tamaño normal), eje en pasos redondos, semanas S1–S8 marcadas, pesajes unidos con línea punteada, tendencia continua (promedio de 7 días con mínimo 2 pesajes) y último peso destacado.
- En el teléfono, las cifras de peso se ven en 2×2 y el porcentaje de progreso alineado a la derecha.
- Foto del Pallof press en polea.

## r94
- Fotos de catálogo: 116 alimentos muestran foto de empaque (y 30 de etiqueta) tomadas de Walmart CR (food-images.js). Se ven en todos los dispositivos; una foto propia del mismo espacio tiene prioridad.
- «Descargar copia» incluye las fotos propias de alimentos y «Importar copia» las restaura (límite del archivo: 80 MB).
- «Exportar fotos» e «Importar fotos» siguen disponibles.
