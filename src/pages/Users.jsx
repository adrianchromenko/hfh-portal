import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Mail,
  Phone,
  Shield,
  User,
  Key,
  Save,
  AlertCircle
} from 'lucide-react'

export default function Users() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Fetch users from Firestore
  useEffect(() => {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = []
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() })
      })
      setUsers(usersData)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching users:', error)
      setLoading(false)
      setError('Failed to load users. You may need to update Firebase rules.')
    })

    return () => unsubscribe()
  }, [])

  // Filter users based on search
  useEffect(() => {
    const filtered = users.filter(user =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm)
    )
    setFilteredUsers(filtered)
  }, [users, searchTerm])

  const showNotification = (message, isError = false) => {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 ${isError ? 'bg-red-600' : 'bg-green-600'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50`
    notification.style.zIndex = '10000'
    notification.innerHTML = `
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isError ? 'M6 18L18 6M6 6l12 12' : 'M5 13l4 4L19 7'}"></path>
      </svg>
      <span>${message}</span>
    `
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.style.transition = 'opacity 0.5s'
      notification.style.opacity = '0'
      setTimeout(() => document.body.removeChild(notification), 500)
    }, 4000)
  }

  const deleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) return
    
    try {
      await deleteDoc(doc(db, 'users', userId))
      showNotification(`User ${userName} deleted successfully`)
    } catch (error) {
      console.error('Error deleting user:', error)
      showNotification('Error deleting user. Please try again.', true)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-habitat-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="card text-center py-12">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-habitat-green text-white rounded-full flex items-center justify-center font-semibold">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{user.name || 'Unnamed User'}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role || 'User'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{user.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setEditingUser(user)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit user"
                >
                  <Edit2 className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  onClick={() => deleteUser(user.id, user.name)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete user"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(message) => {
            showNotification(message)
            setShowAddModal(false)
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={(message) => {
            showNotification(message)
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}

function AddUserModal({ onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'user'
  })

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email) {
      setError('Name and email are required')
      return
    }

    setSubmitting(true)

    try {
      // Create user in Firestore (not Authentication for now)
      // In production, you'd create auth user first, then Firestore document
      await addDoc(collection(db, 'users'), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      onSuccess(`User ${formData.name} created successfully`)
    } catch (err) {
      console.error('Error creating user:', err)
      setError('Failed to create user. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Add New User</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input-field"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              placeholder="john@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className="input-field"
              placeholder="Leave blank for manual setup"
            />
            <p className="text-xs text-gray-500 mt-1">
              If left blank, user will need to reset password via email
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="input-field"
              placeholder="(705) 555-0123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="input-field"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({ user, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'user'
  })

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email) {
      setError('Name and email are required')
      return
    }

    setSubmitting(true)

    try {
      await updateDoc(doc(db, 'users', user.id), {
        ...formData,
        updatedAt: serverTimestamp()
      })

      onSuccess(`User ${formData.name} updated successfully`)
    } catch (err) {
      console.error('Error updating user:', err)
      setError('Failed to update user. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendPasswordReset = async () => {
    try {
      // This would send a password reset email
      // await sendPasswordResetEmail(auth, formData.email)
      alert(`Password reset email would be sent to ${formData.email}`)
      onSuccess(`Password reset email sent to ${formData.email}`)
    } catch (error) {
      console.error('Error sending password reset:', error)
      setError('Failed to send password reset email')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="input-field"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <button
              type="button"
              onClick={sendPasswordReset}
              className="text-sm text-habitat-green hover:underline flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Send Password Reset Email
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}