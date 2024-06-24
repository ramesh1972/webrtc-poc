import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatMessagesWindowComponent } from './chat-messages-window.component';

describe('ChatMessagesWindowComponent', () => {
  let component: ChatMessagesWindowComponent;
  let fixture: ComponentFixture<ChatMessagesWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMessagesWindowComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChatMessagesWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
