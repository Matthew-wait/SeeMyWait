import Toast from 'react-native-toast-message';

type ToastKind = 'success' | 'error';

const inferToastKind = (message: string): ToastKind => {
  const normalized = message.toLowerCase();
  const errorSignals = [
    'fail',
    'failed',
    "couldn't",
    'could not',
    'error',
    'required',
    'must',
    'not set up',
    'already reported',
    'try again',
  ];
  return errorSignals.some((signal) => normalized.includes(signal)) ? 'error' : 'success';
};

export const showToast = (message: string, kind?: ToastKind): void => {
  Toast.show({
    type: kind ?? inferToastKind(message),
    text1: message,
    position: 'top',
    topOffset: 56,
    visibilityTime: 2200,
  });
};
