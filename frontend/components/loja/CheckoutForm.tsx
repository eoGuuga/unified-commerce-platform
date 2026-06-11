'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Truck, Package, MapPin, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/useCart';
import { api } from '@/lib/api-client';
import { TENANT_ID } from '@/lib/config';
import { formatCurrency } from '@/lib/format';
import { toast } from 'react-hot-toast';

interface CheckoutFormProps {
  onSuccess?: () => void;
}

export function CheckoutForm({ onSuccess }: CheckoutFormProps) {
  const router = useRouter();
  const {
    items,
    total,
    subtotal,
    deliveryFee,
    deliveryType,
    cep,
    address,
    setDeliveryType,
    setCep,
    setAddress,
    clearCart,
    canCheckout,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'delivery' | 'payment' | 'confirmation'>('delivery');

  const handleCreateOrder = async () => {
    if (!canCheckout) {
      toast.error('Não é possível finalizar a compra');
      return;
    }

    setIsSubmitting(true);

    try {
      // Criar pedido
      const orderResponse = await api.createOrder({
        channel: 'ecommerce',
        items: items.map(item => ({
          produto_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? {
          street: address || '',
          number: '',
          neighborhood: '',
          city: '',
          state: '',
          zipcode: cep || '',
        } : undefined,
        payment_method: 'pix',
      }, TENANT_ID);

      if (orderResponse.order_no) {
        // Se for PIX, gerar pagamento
        if (deliveryType === 'delivery' && subtotal < 30) {
          // Adicionar taxa de entrega se valor mínimo não atingido
          const paymentResponse = await api.createPayment({
            pedido_id: orderResponse.id,
            method: 'pix',
            amount: total,
          }, TENANT_ID);

          if (paymentResponse.transaction_id) {
            toast.success('Pedido criado! Pagamento PIX gerado.');
            router.push(`/pedido/${orderResponse.order_no}`);
          }
        } else {
          toast.success('Pedido criado com sucesso!');
          router.push(`/pedido/${orderResponse.order_no}`);
        }

        clearCart();
        onSuccess?.();
      }
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast.error(error.response?.data?.message || 'Falha ao criar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCepBlur = async () => {
    if (cep && cep.length === 8 && deliveryType === 'delivery') {
      try {
        // Buscar endereço pelo CEP (simulado)
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setAddress(`${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold">Finalizar Compra</h2>
          <p className="text-gray-600 mt-1">
            {step === 'delivery' && 'Entrega ou retirada'}
            {step === 'payment' && 'Pagamento'}
            {step === 'confirmation' && 'Confirmação'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${step !== 'delivery' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              step === 'delivery' ? 'border-blue-600 bg-blue-600 text-white' :
              'border-green-600 bg-green-600 text-white'
            }`}>
              <Truck className="w-4 h-4" />
            </div>
            <span className="ml-2 text-sm font-medium">Entrega</span>
          </div>

          <div className="w-16 h-0.5 bg-gray-300"></div>

          <div className={`flex items-center ${step !== 'payment' ? 'text-gray-400' : 'text-blue-600'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              step === 'payment' ? 'border-blue-600 bg-blue-600 text-white' :
              'border-gray-300 bg-white'
            }`}>
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="ml-2 text-sm font-medium">Pagamento</span>
          </div>

          <div className="w-16 h-0.5 bg-gray-300"></div>

          <div className={`flex items-center ${step !== 'confirmation' ? 'text-gray-400' : 'text-green-600'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              step === 'confirmation' ? 'border-green-600 bg-green-600 text-white' :
              'border-gray-300 bg-white'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="ml-2 text-sm font-medium">Confirmação</span>
          </div>
        </div>

        <Separator />

        {/* Form Content */}
        <div className="space-y-6">
          {step === 'delivery' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Como você quer receber seu pedido?</h3>

              <RadioGroup value={deliveryType} onValueChange={(value) => setDeliveryType(value as 'delivery' | 'pickup')}>
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery" className="flex items-center space-x-2 cursor-pointer">
                    <Truck className="w-5 h-5" />
                    <span>Entrega</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup" className="flex items-center space-x-2 cursor-pointer">
                    <Package className="w-5 h-5" />
                    <span>Retirada na loja</span>
                  </Label>
                </div>
              </RadioGroup>

              {deliveryType === 'delivery' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={cep || ''}
                      onChange={(e) => setCep(e.target.value)}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço completo</Label>
                    <Input
                      id="address"
                      value={address || ''}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, número, bairro"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep('payment')}
                className="w-full"
                disabled={!deliveryType || (deliveryType === 'delivery' && (!cep || !address))}
              >
                Continuar para pagamento
              </Button>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Forma de pagamento</h3>

              <RadioGroup defaultValue="pix">
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix" className="flex items-center space-x-2 cursor-pointer">
                    <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">PIX</span>
                    </div>
                    <span>Pix</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-4 border rounded-lg opacity-50 cursor-not-allowed">
                  <RadioGroupItem value="credit" id="credit" disabled />
                  <Label htmlFor="credit" className="flex items-center space-x-2 cursor-not-allowed">
                    <CreditCard className="w-5 h-5" />
                    <span>Cartão de crédito</span>
                  </Label>
                </div>
              </RadioGroup>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  {deliveryType === 'delivery' && subtotal < 30
                    ? `Taxa de entrega: ${formatCurrency(deliveryFee)}`
                    : 'Frete grátis!'
                  }
                </p>
              </div>

              <Button
                onClick={() => setStep('confirmation')}
                className="w-full"
              >
                Confirmar pedido
              </Button>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold">Pronto para finalizar!</h3>
                <p className="text-gray-600 mt-2">
                  Revise seus dados e confirme o pedido
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Frete</span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                onClick={handleCreateOrder}
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processando...' : 'Confirmar pedido'}
              </Button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-3">Resumo do pedido</h4>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}