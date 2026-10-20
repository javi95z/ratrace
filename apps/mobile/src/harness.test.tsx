// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Text, View } from 'react-native';
import { expect, test } from 'vitest';

test('react-native components render in the test harness', () => {
  const { getByText } = render(
    <View testID="box">
      <Text>hola</Text>
    </View>,
  );
  expect(getByText('hola')).toBeTruthy();
});
