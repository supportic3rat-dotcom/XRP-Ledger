import { act, fireEvent, screen } from '@testing-library/react-native';
import { IdentityCaptureScreen } from '@/features/onboarding/IdentityCaptureScreen';
import { renderScreen } from './render';

type CameraProps = { onCameraReady?: () => void; onMountError?: () => void };
const mockCamera: { props: CameraProps | null; takePicture: jest.Mock; permission: { granted: boolean; canAskAgain: boolean }; request: jest.Mock } = {
  props: null,
  takePicture: jest.fn(),
  permission: { granted: true, canAskAgain: true },
  request: jest.fn(),
};

jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    CameraView: forwardRef((props: CameraProps, ref: unknown) => {
      mockCamera.props = props;
      useImperativeHandle(ref, () => ({ takePictureAsync: mockCamera.takePicture }));
      return null;
    }),
    useCameraPermissions: () => [mockCamera.permission, mockCamera.request],
  };
});
jest.mock('expo-local-authentication', () => ({ SecurityLevel: { NONE: 0 }, getEnrolledLevelAsync: jest.fn(async () => 0) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///id.jpg', size: 1000 }] })) }));

const openFrontStep = async () => {
  await renderScreen(<IdentityCaptureScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
};
const cameraReady = () => act(async () => mockCamera.props?.onCameraReady?.());

describe('Identity document capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCamera.props = null;
    mockCamera.permission = { granted: true, canAskAgain: true };
    mockCamera.takePicture.mockResolvedValue({ uri: 'file:///front.jpg' });
    mockCamera.request.mockResolvedValue({ granted: true });
  });

  it('waits for the camera, then keeps the real photo', async () => {
    await openFrontStep();
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();
    await cameraReady();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(mockCamera.takePicture).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Use photo' })).toBeTruthy();
  });

  it('asks for camera access on arrival and records no photo without one', async () => {
    mockCamera.permission = { granted: false, canAskAgain: true };
    mockCamera.request.mockResolvedValue({ granted: false });
    await openFrontStep();
    expect(mockCamera.request).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByText(/Camera access is needed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use photo' })).toBeNull();
  });

  it('explains a failed start, retries, and allows an upload instead', async () => {
    await openFrontStep();
    await act(async () => mockCamera.props?.onMountError?.());
    expect(await screen.findByText(/camera didn’t start/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText(/camera didn’t start/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Upload photo' }));
    expect(await screen.findByRole('button', { name: 'Use photo' })).toBeTruthy();
  });

  it('reports a failed shot instead of moving on', async () => {
    mockCamera.takePicture.mockRejectedValue(new Error('hardware'));
    await openFrontStep();
    await cameraReady();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByText(/couldn’t take that photo/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use photo' })).toBeNull();
  });
});
