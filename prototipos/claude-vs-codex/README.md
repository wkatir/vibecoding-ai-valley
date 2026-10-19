# Prototipo 1: Claude vs Codex

Primera iteración del proyecto. Es un juego de naves en 3D hecho con React Three Fiber a partir del prompt 1 (está explicado en el README de la raíz).

- Claude es la nave naranja. Codex es el jefe: una nube con un prompt `>_`.
- El jefe tiene 3 fases: abanicos de balas, muros con un hueco y anillos, y al final un rayo con aviso.
- La nave dispara sola. La habilidad `/clear` borra todas las balas y daña al jefe.

## Ejecutar

Sin instalar nada: abrir `jugar.html` en el navegador.

Desde el código:

```bash
npm install
npm run dev
```

Controles: WASD, flechas o mouse. Espacio lanza `/clear`. P pausa. M silencia.

## Validación

- `npm run sim` juega con bots sin gráficos. Un bot que esquiva gana en unos 45 segundos. Un jugador quieto pierde en unos 16.
- La escena se montó con el renderizador de pruebas de React Three Fiber y se avanzó por todos los estados (fases, rayo, victoria, derrota) sin errores.
- Se abrió en Chromium sin pantalla y se tomó una captura (`../../evidencia/08-prototipo-1-claude-vs-codex.png`).
