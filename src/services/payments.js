import { supabase } from '../lib/supabase';

export const paymentService = {
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    *,
                    patients (
                        users (
                            first_name,
                            last_name
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching payments:', error.message);
            return { data: null, error };
        }
    },

    async create(paymentData) {
        try {
            const { data, error } = await supabase
                .from('payments')
                .insert([paymentData])
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error creating payment:', error.message);
            return { data: null, error };
        }
    },

    async update(id, updates) {
        try {
            const { data, error } = await supabase
                .from('payments')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error updating payment:', error.message);
            return { data: null, error };
        }
    },

    async delete(id) {
        try {
            const { error } = await supabase
                .from('payments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (error) {
            console.error('Error deleting payment:', error.message);
            return { error };
        }
    }
};
