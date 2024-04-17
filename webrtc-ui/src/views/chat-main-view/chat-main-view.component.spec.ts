import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatMainViewComponent } from './chat-main-view.component';

describe('ChatMainViewComponent', () => {
  let component: ChatMainViewComponent;
  let fixture: ComponentFixture<ChatMainViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMainViewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChatMainViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
