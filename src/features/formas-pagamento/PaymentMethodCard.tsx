import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PaymentMethod } from './types';
// Assumindo a importação dos tokens de design conforme as diretrizes
import { colors } from '../../ui/tokens';

interface PaymentMethodCardProps {
  method: PaymentMethod;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function PaymentMethodCard({ method, onEdit, onDelete }: PaymentMethodCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{method.name}</Text>

      {!method.isFixed && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.touchTarget}
            onPress={() => onEdit?.(method.id)}
            accessibilityLabel={`Editar ${method.name}`}
          >
            <Text style={styles.editButton}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.touchTarget}
            onPress={() => onDelete?.(method.id)}
            accessibilityLabel={`Apagar ${method.name}`}
          >
            <Text style={styles.deleteButton}>Apagar</Text>
          </TouchableOpacity>
        </View>
      )}

      {method.isFixed && (
        <View style={styles.fixedBadge}>
          <Text style={styles.fixedText}>Padrão</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, // Borda hairline exigida pelo design
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
  },
  touchTarget: {
    minWidth: 44, // Área de toque mínima exigida (44x44pt)
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  editButton: {
    color: '#0EA5E9', // Accent CTA
    fontWeight: '600',
  },
  deleteButton: {
    color: '#EF4444',
    fontWeight: '600',
  },
  fixedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  fixedText: {
    fontSize: 12,
    color: '#6B7280',
  },
});