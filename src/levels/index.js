import { buildApartment } from './apartment.js';
import { buildLobby } from './lobby.js';
import { buildOffice } from './office.js';
import { buildFloorZero } from './floorZero.js';
import { buildCore } from './core.js';

// 장소 목록: 챕터, 시간, 자아, 진입 시 재생할 스토리 노드, 배경음
export const LEVELS = {
  apartment_day: {
    chapter: 'PROLOGUE · 내 몸에 남겨진 경고',
    title: '내 몸에 남겨진 경고',
    place: 'Julian의 아파트',
    time: '07:30',
    self: 'day',
    enter: 'intro',
    drone: [65, 0.025],
    build: (ctx) => buildApartment(ctx, { night: false }),
  },
  lobby: {
    chapter: 'CHAPTER 1 · 낮 — 회사 서버실 잠입',
    title: '루멘 바이오닉스 본사',
    place: '1층 로비',
    time: '08:51',
    self: 'day',
    enter: 'lobby_arrive',
    drone: [55, 0.03],
    build: buildLobby,
  },
  office17: {
    chapter: 'CHAPTER 1 · 낮 — 회사 서버실 잠입',
    title: '사라진 17분',
    place: '17층 · 서버실 B',
    time: '14:40',
    self: 'day',
    enter: 'off_arrive',
    drone: [49, 0.04],
    build: buildOffice,
  },
  apartment_night: {
    chapter: 'CHAPTER 2 · 밤 — 사라진 증거 추적',
    title: '사라진 증거 추적',
    place: 'Julian의 아파트 (밤)',
    time: '23:10',
    self: 'night',
    enter: 'night_arrive',
    drone: [41, 0.05],
    build: (ctx) => buildApartment(ctx, { night: true }),
  },
  floor_zero: {
    chapter: 'CHAPTER 3 · 삭제된 기억의 비밀',
    title: '삭제된 기억의 비밀',
    place: '지하 0층 · PROJECT TRIAD',
    time: '09:02',
    self: 'day',
    enter: 'zero_arrive',
    drone: [36.7, 0.05],
    build: buildFloorZero,
  },
  core: {
    chapter: 'CHAPTER 4 · 두 자아의 충돌',
    title: '두 자아의 충돌',
    place: '코어실',
    time: '09:31',
    self: 'day',
    enter: 'core_arrive',
    drone: [32.7, 0.07],
    build: buildCore,
  },
};
