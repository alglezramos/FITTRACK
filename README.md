# FitTrack — versión del 19 de octubre de 2026

Aplicación web instalable (PWA), compatible con GitHub Pages.

## Publicación
1. Descomprime este ZIP.
2. Sube **el contenido de esta carpeta** (no el ZIP ni una carpeta envolvente) a la raíz del repositorio GitHub.
3. En GitHub abre Settings → Pages, selecciona Deploy from a branch, `main` y `/ (root)`, y guarda.
4. Abre la URL publicada y actualiza la app. Si la tienes instalada, puede requerir cerrar y volver a abrir.

## Recuperar tus datos
La copia `fittrack-copia-completa.json` se entrega como **descarga separada y privada**. No la publiques en GitHub. En la aplicación abre Opciones / copias de seguridad y usa **Importar copia completa** para restaurar recetas, alimentos, diario y progreso.

Nota: este paquete reúne la base del proyecto y los archivos de interfaz recuperados de la última versión disponible; no se han reconstruido funciones ausentes ni se garantiza que refleje cada cambio solicitado verbalmente.

## Recetas incluidas de forma predeterminada
Huevo + Hashbrown; Burrito Carne Molida de Cerdo; Arroz con carne molida. Se incluyen Hashbrown, Arroz con vegetales y Carne molida mixta con las calorías editadas en el respaldo. No se incluye ninguna entrada del diario ni dato personal. Las recetas existentes en copias importadas tienen prioridad y no se duplican.

## Ajustes posteriores
- El calendario muestra Fondo o hiking **fijo el sábado**, sin selector para moverlo. El domingo sigue disponible en el registro de actividades para cuando se realice allí.
- La pestaña «Menús» ahora se llama «Recetas». «Crear receta» está al final del listado de recetas y ya no ocupa una pestaña independiente.

## Versión r16 (20-oct-2026)
- Paquete completo: código «Hoy · meta −10 kg» + iconos + las 28 fotos de ejercicios en `assets/`.
- ⚙ Opciones vuelve a abrir el panel con **Inicio del programa** y **Peso inicial**; desde ahí, «Copia completa» lleva a exportar/importar.
- Corregido: cambiar el peso inicial en Opciones daba error.
- Corregido: las fotos se cargan desde `assets/` (antes apuntaban a la raíz).
- El modo sin conexión ya no falla si algún archivo no está en el servidor.

## Versión r25 (20-oct-2026) · diseño unificado
- Encabezado compacto con semana y día; pestañas principales fijas arriba (Hoy · Comida · Entreno · Progreso).
- Un solo estilo de sub-pestañas, títulos, botones (principal / secundario / discreto), campos, casillas de cifras y listas.
- Compactados: Alimentos, Recetas (agrupadas por tipo), Súper, Cardio, Retos, Kilómetros, Hábitos, calendario semanal y balance.
- Plan: cada comida de los 7 días se puede cambiar.
- Catálogo: +8 frutas, mostaza y salsa Lizano; alimentos y recetas propios incluidos; res y cerdo confirmados.
- Corregido: la pestaña Recetas no se abría.

## Versión r31 (20-oct-2026)
- **Registro rápido en Hoy:** las 6 comidas del plan del día con «✓ Comí esto» (un toque) y «Deshacer», «+ Otra comida», y Whoop + pasos en la misma tarjeta.
- **Misiones:** nuevo dashboard (semana actual, misiones totales/completadas/en progreso, progreso general y tarjetas por misión con icono y color).
- **Día 4 · Hombro:** 6 ejercicios (desarrollo en silla y remo a una mano). El programa suma 30 ejercicios por semana.
- **Almacenamiento único** (`store.js`, clave `fittrack.data.v2`). Al abrir esta versión se copian automáticamente los datos de las claves antiguas, que se conservan como respaldo.
- Código legible (sin minificar), CSS consolidado en una sola hoja y código sin uso eliminado.
- Corregido: errores al redibujar al guardar pesos en Fuerza.
