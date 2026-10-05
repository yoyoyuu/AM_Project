import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { Commission, ArtistProfile } from '../types/index';

// datos pa calarle
const INITIAL_COMMISSIONS: Commission[] = [
  {
    id: '1',
    clientName: 'Octavio',
    title: 'Fanart estilo Chibi',
    style: 'Chibi',
    price: 300,
    stage: 'Boceto',
    paymentStatus: 'Anticipo Pagado',
    updatedAt: 'Hace 2 horas',
  },
  {
    id: '2',
    clientName: 'C3 (Cliente Frecuente)',
    title: 'Ilustración Personaje Anime',
    style: 'Full Color / Cartoon',
    price: 600,
    stage: 'Lineart',
    paymentStatus: 'Anticipo Pagado',
    updatedAt: 'Ayer',
  },
];

export const DashboardScreen = ({ onSelectCommission }: { onSelectCommission: (c: Commission) => void }) => {
  const [profile] = useState<ArtistProfile>({
    name: 'A2 / Artista Digital',
    slotsLimit: 3,
    activeSlots: 2,
  });

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Pendiente': return '#FF9800';
      case 'Boceto': return '#2196F3';
      case 'Lineart': return '#9C27B0';
      case 'Color': return '#E91E63';
      case 'Finalizado': return '#4CAF50';
      default: return '#757575';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>Koma</Text>
          <Text style={styles.artistName}>{profile.name}</Text>
        </View>
        <View style={styles.slotsCard}>
          <Text style={styles.slotsLabel}>Cupos Activos</Text>
          <Text style={styles.slotsValue}>
            {profile.activeSlots} / {profile.slotsLimit}
          </Text>
        </View>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Comisiones en Proceso</Text>
        <FlatList
          data={INITIAL_COMMISSIONS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectCommission(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.clientName}>{item.clientName}</Text>
                <View style={[styles.badge, { backgroundColor: getStageColor(item.stage) }]}>
                  <Text style={styles.badgeText}>{item.stage}</Text>
                </View>
              </View>

              <Text style={styles.commissionTitle}>{item.title}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>${item.price} MXN</Text>
                <Text style={styles.paymentBadge}>{item.paymentStatus}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  brandTitle: { fontSize: 24, fontWeight: '800', color: '#6C5CE7' },
  artistName: { fontSize: 14, color: '#636E72', marginTop: 2 },
  slotsCard: {
    backgroundColor: '#F1F2F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  slotsLabel: { fontSize: 10, textTransform: 'uppercase', color: '#2D3436', fontWeight: '600' },
  slotsValue: { fontSize: 16, fontWeight: '700', color: '#6C5CE7', marginTop: 2 },
  listContainer: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2D3436', marginBottom: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientName: { fontSize: 14, fontWeight: '600', color: '#636E72' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  commissionTitle: { fontSize: 16, fontWeight: '600', color: '#2D3436', marginVertical: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  priceText: { fontSize: 15, fontWeight: '700', color: '#2D3436' },
  paymentBadge: { fontSize: 12, color: '#00B894', fontWeight: '600' },
});