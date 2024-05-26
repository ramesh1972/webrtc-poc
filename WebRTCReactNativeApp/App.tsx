/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';


import ChatWindow from './src/views/ChatWindow';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <View
        contentInsetAdjustmentBehavior="automatic"
        style={styles.appContainer}>
         <ChatWindow />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
appContainer: {
    flex: 1,
    justifyContent: 'left',
    alignItems: 'left',
    backgroundColor: '#F5FCFF',
    }
});

export default App;
