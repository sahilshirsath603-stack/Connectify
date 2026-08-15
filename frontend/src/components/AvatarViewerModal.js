import React, { useState, useRef, useEffect } from 'react';
import AvatarCropModal from './AvatarCropModal';
import { uploadAvatar } from '../services/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const AvatarViewerModal = ({ user, group, currentUser, onClose, onProfileUpdate }) => {
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef(null);

  const isSelf = currentUser && user && currentUser._id === user._id;
  const isGroupAdmin = group && currentUser && group.admins && group.admins.some(admin => admin._id?.toString() === currentUser._id);
  const displayEntity = user || group;

  useEffect(() => {
    setImgError(false);
  }, [displayEntity?.avatar]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleChangePhoto = async () => {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        // Automatically requests OS permissions and safely opens OS file picker intent
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
        });
        setImageSrc(image.webPath);
        setShowCropModal(true);
      } else {
        fileInputRef.current.click();
      }
    } catch (error) {
      console.error("Permission denied or user cancelled:", error);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async (croppedBlob) => {
    try {
      let updatedEntity;
      if (group) {
        // For groups, use the group update endpoint
        const formData = new FormData();
        formData.append('avatar', croppedBlob);
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${group._id}/update`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        });
        updatedEntity = await response.json();
      } else {
        // For users, use the existing uploadAvatar
        updatedEntity = await uploadAvatar(croppedBlob);
      }
      setShowCropModal(false);
      setImageSrc(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onProfileUpdate) onProfileUpdate(updatedEntity);
      onClose(); // Close viewer after update
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar');
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* Avatar Viewer Modal */}
      <div style={styles.overlay} onClick={handleBackdropClick}>
        <div style={styles.modal}>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
          <div style={styles.avatarContainer}>
            {displayEntity.avatar && !imgError ? (
              <img
                src={displayEntity.avatar}
                alt="Avatar"
                style={styles.avatarImage}
                onError={() => setImgError(true)}
              />
            ) : (
              <div style={styles.avatarFallback}>
                {group ? (group?.name || '?').charAt(0).toUpperCase() : (user?.name || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {(isSelf || isGroupAdmin) && (
            <button onClick={handleChangePhoto} style={styles.changePhotoBtn}>
              Change photo
            </button>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <AvatarCropModal
          imageSrc={imageSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 20,
    zIndex: 1,
  },
  avatarContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarImage: {
    maxWidth: '80vw',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: 8,
  },
  avatarFallback: {
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: '#25d366',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 80,
    fontWeight: 'bold',
  },
  changePhotoBtn: {
    background: '#25d366',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 'bold',
  },
};

export default AvatarViewerModal;
