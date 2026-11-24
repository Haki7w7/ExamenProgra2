import { onUnmounted, ref } from 'vue';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network, type ConnectionStatus } from '@capacitor/network';

/**
 * TODO [M7] Capacidades nativas (6 pts en total: este archivo, PerfilPage.vue y AndroidManifest.xml).
 *
 * useConexion() devuelve { conectado, tipo }:
 *   - Valor inicial con Network.getStatus()                       (@capacitor/network)
 *   - Se actualiza solo con Network.addListener('networkStatusChange', ...)
 *   - El oyente se libera (handle.remove()) cuando se destruye la página que lo usa (onUnmounted).
 *   Las páginas Equipos y Formulario ya muestran el aviso "Sin conexión" y deshabilitan Guardar con `conectado`.
 */
export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  const aplicarEstado = (estado: ConnectionStatus) => {
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  };

  let desmontado = false;
  let oyente: PluginListenerHandle | null = null;

  void Network.getStatus().then((estado) => {
    if (!desmontado) aplicarEstado(estado);
  });

  void Network.addListener('networkStatusChange', aplicarEstado).then((handle) => {
    if (desmontado) {
      void handle.remove();
    } else {
      oyente = handle;
    }
  });

  onUnmounted(() => {
    desmontado = true;
    void oyente?.remove();
  });

  return { conectado, tipo };
}

/**
 * TODO [M7] vibrar(): vibración breve de confirmación con Haptics.impact({ style: ImpactStyle.Light })
 *   (@capacitor/haptics). En el navegador NO debe hacer nada: use Capacitor.isNativePlatform().
 *   Se llama después de guardar y de eliminar con éxito.
 */
export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}
