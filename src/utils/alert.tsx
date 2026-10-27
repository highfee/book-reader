import { Alert as NativeAlert, Platform } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';
import { WebAlert, WebAlertHost } from './alertWebImpl';

interface AlertApi {
  alert(title?: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void;
}

/**
 * react-native-web ships `Alert.alert` as an empty static method, so on the web build every
 * confirmation, error and success message silently did nothing — a reader who pressed Delete Shelf
 * got no dialog and no action. Call sites import this `Alert` instead: native keeps the operating
 * system's own alert, web renders a real dialog through the host mounted in the root layout.
 */
export const Alert: AlertApi = Platform.OS === 'web' ? WebAlert : NativeAlert;

export function AlertHost() {
  return Platform.OS === 'web' ? <WebAlertHost /> : null;
}
