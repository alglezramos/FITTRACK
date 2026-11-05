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
