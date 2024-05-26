import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StreamingWindowComponent } from './streaming-window.component';

describe('StreamingWindowComponent', () => {
  let component: StreamingWindowComponent;
  let fixture: ComponentFixture<StreamingWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreamingWindowComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StreamingWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
