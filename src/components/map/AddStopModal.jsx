import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { geocodeAddress } from '../../utils/geocode'
import { X } from 'lucide-react'

export default function AddStopModal({ selectedDate, onClose }) {
  const [type, setType] = useState('pickup')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'ON',
    zip: '',
    items: '',
    notes: ''
  })

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate required fields
    const required = ['name', 'phone', 'address', 'city', 'state', 'zip', 'items']
    for (const field of required) {
      if (!formData[field].trim()) {
        setError(`Please fill in the ${field} field.`)
        return
      }
    }

    setSubmitting(true)

    try {
      // Geocode address
      let coords = null
      try {
        coords = await geocodeAddress(formData.address, formData.city, formData.state, formData.zip)
      } catch (geoErr) {
        console.warn('Geocoding failed:', geoErr)
      }

      // Write to Firestore
      await addDoc(collection(db, 'bookings'), {
        ...formData,
        date: selectedDate,
        type,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        status: 'confirmed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      onClose()
    } catch (err) {
      console.error('Error adding stop:', err)
      setError('Failed to add stop. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Add {type === 'delivery' ? 'Delivery' : 'Pickup'}
            </h2>
            <p className="text-sm text-gray-500">For {selectedDate}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              {['pickup', 'delivery'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    type === t
                      ? 'bg-habitat-green text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input-field"
              placeholder={type === 'delivery' ? 'Customer / recipient name' : 'Donor name'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
              <input name="phone" type="tel" value={formData.phone} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} className="input-field" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input name="address" value={formData.address} onChange={handleChange} className="input-field" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
              <input name="city" value={formData.city} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province <span className="text-red-500">*</span></label>
              <input name="state" value={formData.state} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code <span className="text-red-500">*</span></label>
              <input name="zip" value={formData.zip} onChange={handleChange} className="input-field" />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Items <span className="text-red-500">*</span>
            </label>
            <textarea
              name="items"
              value={formData.items}
              onChange={handleChange}
              rows={3}
              className="input-field"
              placeholder={type === 'delivery' ? 'Items to deliver' : 'Items to pick up'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="input-field"
              placeholder="Access instructions, special notes, etc."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Adding...
                </>
              ) : (
                `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
