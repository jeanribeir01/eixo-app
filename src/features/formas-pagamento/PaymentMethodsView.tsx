import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { PaymentMethodCard } from './PaymentMethodCard';
import { FIXED_PAYMENT_METHODS } from './constants';
import { PaymentMethod } from './types';
// Assumindo a importação dos tokens de design
import { colors } from '../../ui/tokens';

export function PaymentMethodsView() {
  // Estado para os métodos personalizados (CRUD)
  const [customMethods, setCustomMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // Junta as listas: primeiro os fixos, depois os personalizados
  const allMethods = [...FIXED_PAYMENT_METHODS, ...customMethods];

  const showSnackbar = (msg: string) => {
    setSnackbarMessage(msg);
    setTimeout(() => setSnackbarMessage(null), 3000); // Desaparece após 3s
  };

  const handleDelete = (id: string) => {
    setIsLoading(true);
    // Simulação de chamada à API com soft-delete
    setTimeout(() => {
      setCustomMethods(prev => prev.filter(m => m.id !== id));
      setIsLoading(false);
      showSnackbar('Forma de pagamento removida com sucesso.');
    }, 1000);
  };

  const handleEdit = (id: string) => {
    // A ser implementado na Tarefa 4 (Formulário)
    console.log('Abrir formulário para editar', id);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Formas de Pagamento</Text>

      {isLoading && (
        <ActivityIndicator size="small" color="#0EA5E9" style={styles.loader} />
      )}

      <FlatList
        data={allMethods}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PaymentMethodCard
            method={item}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        )}
        contentContainerStyle={styles.list}
      />

      {/* Snackbar Feedback */}
      {snackbarMessage && (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Fallback para colors.canvas
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    color: '#111827'
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  loader: {
    marginVertical: 8
  },
  snackbar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 4, // Sombra no Android
  },
  snackbarText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '500'
  }
});