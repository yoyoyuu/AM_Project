import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  TextInput,
  findNodeHandle,
  UIManager,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme';

export interface KeyboardAwareScrollProps extends ScrollViewProps {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle | ViewStyle[];
  extraOffset?: number;
  backgroundColor?: string;
}

/**
 * ScrollView que:
 * - En iOS usa KeyboardAvoidingView con padding.
 * - En Android añade paddingBottom dinámico igual al alto real del teclado,
 *   y hace scroll automático al TextInput enfocado para que quede visible.
 *   Esto evita que el teclado tape inputs al fondo de la pantalla.
 */
export function KeyboardAwareScroll({
  children,
  contentContainerStyle,
  extraOffset = 0,
  backgroundColor = colors.background,
  ...rest
}: KeyboardAwareScrollProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates.height;
      setKeyboardHeight(h);
      // Scroll al input enfocado dejándole espacio sobre el teclado
      setTimeout(() => {
        const focused = TextInput.State.currentlyFocusedInput?.();
        const node = focused ? findNodeHandle(focused) : null;
        const scrollNode = scrollRef.current
          ? findNodeHandle(scrollRef.current)
          : null;
        if (!node || !scrollNode) return;
        UIManager.measureLayout(
          node,
          scrollNode,
          () => {},
          (_x, y, _w, inputHeight) => {
            const target = Math.max(0, y - 80);
            scrollRef.current?.scrollTo({ y: target, animated: true });
          },
        );
      }, 50);
    };
    const onHide = () => setKeyboardHeight(0);

    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const dynamicPadding = keyboardHeight > 0 ? keyboardHeight + extraOffset : 32;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={extraOffset}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...rest}
        contentContainerStyle={[
          styles.content,
          contentContainerStyle,
          { paddingBottom: dynamicPadding },
        ]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});

export default KeyboardAwareScroll;
