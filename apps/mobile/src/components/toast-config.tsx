import { BaseToast, type BaseToastProps, ErrorToast } from 'react-native-toast-message';

/**
 * Custom toast rendering: allow text1 to wrap to 2 lines so longer messages
 * (e.g. the location hint) aren't truncated, while keeping the default look.
 */
const text1Style = { fontSize: 14, fontWeight: '600' as const, color: '#0f172a' };
const contentContainerStyle = { paddingHorizontal: 14, paddingVertical: 8 } as const;
// Let height grow for a 2nd line instead of clipping the fixed default height.
const autoHeight = { height: undefined, minHeight: 60 } as const;

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      text1NumberOfLines={2}
      text1Style={text1Style}
      style={[props.style, autoHeight, { borderLeftColor: '#22c55e' }]}
      contentContainerStyle={contentContainerStyle}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      text1NumberOfLines={2}
      text1Style={text1Style}
      style={[props.style, autoHeight, { borderLeftColor: '#ef4444' }]}
      contentContainerStyle={contentContainerStyle}
    />
  ),
};
