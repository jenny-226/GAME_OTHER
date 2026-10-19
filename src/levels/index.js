import { buildApartment } from './apartment.js';
import { buildLobby } from './lobby.js';
import { buildOffice } from './office.js';
import { buildFloorZero } from './floorZero.js';
import { buildCore } from './core.js';

// 장소 목록: 챕터, 시간, 자아, 진입 시 재생할 스토리 노드, 배경음
export const LEVELS = {
  apartment_day: {
    chapter: 'CHAPTER 1 · 내가 남긴 경고',
    title: '내가 남긴 경고',
    place: 'Julian의 아파트',
    time: '07:30',
    self: 'day',
    enter: 'intro',
    drone: [65, 0.025],
    build: (ctx) => buildApartment(ctx, { night: false }),
  },
  lobby: {
    chapter: 'CHAPTER 1 · 내가 남긴 경고',
    title: '루멘 바이오닉스 본사',
    place: '1층 로비',
    time: '08:51',
    self: 'day',
    enter: 'lobby_arrive',
    drone: [55, 0.03],
    build: buildLobby,
  },
  office17: {
    chapter: 'CHAPTER 2 · 사라진 17분',
    title: '사라진 17분',
    place: '17층 · 서버실 B',
    time: '14:40',
    self: 'day',
    enter: 'off_arrive',
    drone: [49, 0.04],
    build: buildOffice,
  },
  apartment_night: {
    chapter: 'CHAPTER 2 · 사라진 17분',
    title: '밤의 나',
    place: 'Julian의 아파트 (밤)',
    time: '23:10',
    self: 'night',
    enter: 'night_arrive',
    drone: [41, 0.05],
    build: (ctx) => buildApartment(ctx, { night: true }),
  },
  floor_zero: {
    chapter: 'CHAPTER 3 · 세 번째 나',
    title: '세 번째 나',
    place: '지하 0층 · PROJECT TRIAD',
    time: '09:02',
    self: 'day',
    enter: 'zero_arrive',
    drone: [36.7, 0.05],
    build: buildFloorZero,
  },
  core: {
    chapter: 'CHAPTER 4 · 누구를 삭제할 것인가',
    title: '누구를 삭제할 것인가',
    place: '코어실',
    time: '09:31',
    self: 'day',
    enter: 'core_arrive',
    drone: [32.7, 0.07],
    build: buildCore,
  },
};
