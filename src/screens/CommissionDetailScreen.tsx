import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Commission, Stage } from '../types';

interface Props {
  commission: Commission;
  onBack: () => void;
}

export const CommissionDetailScreen = ({ commission, onBack }: Props) => {
  const [currentStage, setCurrentStage] = useState<Stage>(commission.stage);

  const stages: Stage[] = ['Pendiente', 'Boceto', 'Lineart', 'Color', 'Finalizado'];

  const handleUpdateStage = (newStage: Stage) => {
    setCurrentStage(newStage);
    Alert.alert('Estado Actualizado', `La comisión cambió a: ${newStage}. Notificación enviada al cliente.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Encargo</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{commission.title}</Text>
        <Text style={styles.client}>Cliente: {commission.clientName}</Text>
        <Text style={styles.info}>Precio: ${commission.price} MXN | Estilo: {commission.style}</Text>

        <Text style={styles.subTitle}>Cambiar Etapa de Avance:</Text>
        
        {stages.map((stage) => (
          <TouchableOpacity
            key={stage}
            style={[
              styles.stageOption,
              currentStage === stage && styles.selectedStage,
            ]}
            onPress={() => handleUpdateStage(stage)}
          >
            <Text
              style={[
                styles.stageText,
                currentStage === stage && styles.selectedStageText,
              ]}
            >
              {stage} {currentStage === stage ? '✓' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  backButton: { fontSize: 16, color: '#6C5CE7', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', marginLeft: 20 },
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#2D3436' },
  client: { fontSize: 16, color: '#636E72', marginTop: 5 },
  info: { fontSize: 14, color: '#B2BEC3', marginTop: 5, marginBottom: 20 },
  subTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#2D3436' },
  stageOption: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DFE4EA',
    marginBottom: 10,
  },
  selectedStage: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  stageText: { fontSize: 15, fontWeight: '600', color: '#2D3436' },
  selectedStageText: { color: '#FFFFFF' },
});