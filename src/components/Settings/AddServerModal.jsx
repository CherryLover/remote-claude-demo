import React, { useState } from 'react';
import { api } from '../../utils/api';

const AddServerModal = ({ isOpen, onClose, onAdded }) => {
    const [formData, setFormData] = useState({
        alias: '',
        host: '',
        port: 22,
        username: 'root',
        password: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'port' ? parseInt(value) || 22 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.addServer(formData);
            if (res.success) {
                onAdded();
                onClose();
                setFormData({ alias: '', host: '', port: 22, username: 'root', password: '' });
            } else {
                alert('Failed to add server: ' + res.message);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add New Server</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit} id="addServerForm">
                        <div className="form-group">
                            <label>Alias (ID)</label>
                            <input name="alias" value={formData.alias} onChange={handleChange} placeholder="e.g., prod-db" required />
                        </div>
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 3 }}>
                                <label>Host IP</label>
                                <input name="host" value={formData.host} onChange={handleChange} placeholder="192.168.1.x" required />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Port</label>
                                <input name="port" type="number" value={formData.port} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Username</label>
                                <input name="username" value={formData.username} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input name="password" type="password" value={formData.password} onChange={handleChange} />
                            </div>
                        </div>
                    </form>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" form="addServerForm" className="btn btn-primary">Add Server</button>
                </div>
            </div>
        </div>
    );
};

export default AddServerModal;
